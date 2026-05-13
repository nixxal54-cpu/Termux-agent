import { STATES, StateMachine } from './state_machine.js';
import { bus, EVENTS } from './event_bus.js';
import { UI } from '../utils/formatter.js';
import { ResilientParser } from './parser.js';
import { checkpointSys } from './checkpoints.js';

export class Orchestrator {
  constructor(provider, executor, memory, planner, reflection, contextMgr) {
    this.provider = provider;
    this.executor = executor;
    this.memory = memory;
    this.planner = planner; // might be obsolete depending on how planner is integrated, keeping for compat
    this.reflection = reflection;
    this.contextMgr = contextMgr;
    this.stateMachine = new StateMachine();
  }

  async runObjective(userRequest) {
    this.memory.addMessage({ role: 'user', content: userRequest });
    let turnCount = 0;
    const MAX_TURNS = 30;
    let lastAction = null;
    let lastResult = null;

    // Reset state machine to IDLE before each new task so COMPLETED/FAILED
    // from a previous task doesn't block the while-loop from running at all.
    this.stateMachine.reset();
    this.transitionTo(STATES.ANALYZING);

    while (this.stateMachine.getState() !== STATES.COMPLETED && this.stateMachine.getState() !== STATES.FAILED && turnCount < MAX_TURNS) {
      turnCount++;
      
      const currentState = this.stateMachine.getState();
      
      if (currentState === STATES.ANALYZING) {
         this.transitionTo(STATES.RETRIEVING_CONTEXT);
      } else if (currentState === STATES.RETRIEVING_CONTEXT) {
         // Future placeholder for vector DB retrieval logic 
         this.transitionTo(STATES.PLANNING);
      } else if (currentState === STATES.PLANNING) {
          const schemas = this.executor.getToolSchemas();
          const optimizedHistory = await this.contextMgr.optimize(this.memory.getMessages());
          
          const now = new Date();
          const currentDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const currentYear = now.getFullYear();
          const systemPrompt = `You are an elite autonomous coding agent running inside Termux on Android.

TODAY'S DATE: ${currentDate} (Year: ${currentYear}) — Always use this when searching the web. NEVER append outdated years like 2024 to search queries.

TERMUX/ANDROID HARD CONSTRAINTS — NEVER VIOLATE THESE:
- NO torch, tensorflow, transformers, numpy with C extensions, scipy, or any package requiring native compilation. They will NEVER install on Termux ARM.
- NO "pip install --upgrade pip" (forbidden by Termux).
- NO GUI frameworks (tkinter, pygame, wx). There is no display.
- For web UIs: use plain HTML/CSS/JS served by a lightweight server (http.server, Flask, Express). NO React build steps.
- For AI/ML tasks: use the Groq API (already available via GROQ_API_KEY env var) — do NOT try to run local models.
- For Python packages: prefer stdlib. Safe third-party packages: flask, requests, groq, openai, rich, click, fastapi, uvicorn.
- Shell commands that take longer than 25 seconds will be killed. Split long installs into separate steps.
- For ANY pip install command, ALWAYS pass "timeout": 120000 (2 minutes) — pip is slow on mobile networks.
- Always use "pip install --break-system-packages" when installing Python packages in Termux.

AVAILABLE TOOLS:
${JSON.stringify(schemas, null, 2)}

Project Context:
${this.memory.getProjectFacts ? this.memory.getProjectFacts() : 'No distinct facts stored yet.'}

RESPONSE FORMAT RULES:
1. ALWAYS respond in this exact JSON format:
{
  "thought": "Your internal reasoning. Explain your next action step-by-step.",
  "action": {
    "tool": "tool_name",
    "args": { ... tool arguments ... }
  }
}
2. When the task is fully done and verified, output:
{
  "thought": "Task is done and verified.",
  "action": { "tool": "finish", "args": { "message": "Result summary" } }
}
3. Learn from failures. Never retry the exact same failing command.`;

          const messages = [{ role: 'system', content: systemPrompt }, ...optimizedHistory];

          bus.emit(EVENTS.THINKING_START);
          let responseData;
          try {
            responseData = await this.provider.generate(messages);
          } catch(e) {
            bus.emit(EVENTS.THINKING_END);
            // 413 = context too large — trim old messages and retry once rather than looping
            if (e.message && e.message.includes('413')) {
              UI.error('Context too large — trimming old messages automatically...');
              this.memory.trimToRecent(5); // keep only last 5 exchanges
              continue;
            }
            this.handleSystemError(e);
            continue;
          }
          bus.emit(EVENTS.THINKING_END);

          const actionPayload = ResilientParser.parseJSON(responseData);

          if (!actionPayload || !actionPayload.action || !actionPayload.action.tool) {
             this.transitionTo(STATES.RECOVERING);
             this.memory.addMessage({ role: 'assistant', content: responseData });
             this.memory.addMessage({ role: 'user', content: 'SYSTEM RECOVERY: Output was NOT valid JSON or missed "action.tool". You MUST use the correct JSON format. Parse failure. Try again.' });
             this.transitionTo(STATES.PLANNING);
             continue;
          }

          const { thought, action } = actionPayload;
          UI.agentAction(thought, action);
          this.memory.addMessage({ role: 'assistant', content: JSON.stringify(actionPayload) });

          lastAction = action;

          if (action.tool === 'finish') {
             this.transitionTo(STATES.VERIFYING);
             this.transitionTo(STATES.COMPLETED);
             UI.success(action.args.message || "Task Completed Successfully.");
             break;
          }
          
          this.transitionTo(STATES.CHECKPOINTING);
          if (['patch_file', 'files'].includes(action.tool) && action.args.filePath) {
             try {
                // Ensure we run safety checks early
                const safePath = this.executor.workspace.resolveSafePath(action.args.filePath);
                await checkpointSys.createCheckpoint(safePath);
             } catch (e) {
                // Sandbox violation, ignore checkpoint, executor block will throw
             }
          }

          this.transitionTo(STATES.EXECUTING);
          lastResult = await this.executor.execute(action);
          
          this.transitionTo(STATES.OBSERVING);
          UI.toolResult(JSON.stringify(lastResult, null, 2));
          
          if (lastResult.status === 'error' || lastResult.status === 'timeout') {
              this.transitionTo(STATES.REFLECTING);
              const reflectionAdvice = await this.reflection.analyzeFailure(action, lastResult);
              bus.emit(EVENTS.REFLECTION_RESULT, reflectionAdvice);
              
              if (reflectionAdvice.requiresRollback && action.args.filePath) {
                 this.transitionTo(STATES.ROLLING_BACK);
                 try {
                    const safePath = this.executor.workspace.resolveSafePath(action.args.filePath);
                    await checkpointSys.rollback(safePath);
                    this.memory.addMessage({ role: 'user', content: `Tool Failed: ${JSON.stringify(lastResult)}\nReflection: ${reflectionAdvice.advice}\nAction: Automatically rolled back file to pristine state.` });
                 } catch (e) {
                    this.memory.addMessage({ role: 'user', content: `Tool Failed: ${JSON.stringify(lastResult)}\nReflection: ${reflectionAdvice.advice}\nAction: Automatic rollback failed.` });
                 }
                 this.transitionTo(STATES.PLANNING);
              } else {
                 this.memory.addMessage({ role: 'user', content: `Tool Failed: ${JSON.stringify(lastResult)}\nReflection: ${reflectionAdvice.advice}` });
                 this.transitionTo(STATES.RETRYING);
                 this.transitionTo(STATES.PLANNING);
              }
              
          } else {
              this.transitionTo(STATES.VERIFYING);
              this.memory.addMessage({ role: 'user', content: `Tool Result: ${JSON.stringify(lastResult)}` });
              this.transitionTo(STATES.PLANNING);
          }
      }
    }
    
    if (turnCount >= MAX_TURNS) {
      this.transitionTo(STATES.FAILED);
      UI.error("Max turns reached. Agent loop interrupted to prevent infinite loop.");
    }
  }

  handleSystemError(err) {
    bus.emit(EVENTS.SYSTEM_ERROR, err);
    UI.error(`System Error in Orchestrator: ${err.message}`);

    // Hard-stop errors — looping will never fix these, bail out immediately
    const FATAL_PATTERNS = ['rate limit hit (429)', 'Invalid API Key', 'Unauthorized', 'Bad Request (400)'];
    if (FATAL_PATTERNS.some(p => err.message?.includes(p))) {
      this.transitionTo(STATES.FAILED);
      return;
    }

    this.transitionTo(STATES.RECOVERING);
    this.memory.addMessage({ role: 'user', content: `System Error encountered: ${err.message}. Please recover and retry.` });
    this.transitionTo(STATES.PLANNING);
  }

  transitionTo(state) {
    this.stateMachine.transition(state);
    bus.emit(EVENTS.STATE_CHANGE, state);
  }
}