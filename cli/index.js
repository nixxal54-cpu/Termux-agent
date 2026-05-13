import readline from 'readline';
import ora from 'ora';
import chalk from 'chalk';
import { Sandbox } from '../core/sandbox.js';
import { Executor } from '../core/executor.js';
import { MemoryManager } from '../core/memory.js';
import { Orchestrator } from '../core/orchestrator.js';
import { ContextManager } from '../core/context_manager.js';
import { ReflectionSystem } from '../core/reflection.js';
import { GroqProvider } from '../providers/groq.js';
import { Telemetry } from '../core/telemetry.js';
import { Logger } from '../core/logger.js';
import { UI } from '../utils/formatter.js';
import { shellTool } from '../tools/shell/index.js';
import { filesTool } from '../tools/files/index.js';
import { searchTool } from '../tools/search/index.js';
import { patchTool } from '../tools/patch/index.js';
import { gitTool } from '../tools/git.js';
import { bus, EVENTS } from '../core/event_bus.js';

export async function runCLI() {
  const logger = new Logger();
  await logger.init();

  const telemetry = new Telemetry();
  await telemetry.init();

  const sandbox = new Sandbox(process.cwd());
  const executor = new Executor([shellTool, filesTool, searchTool, patchTool, gitTool], sandbox);
  const memory = new MemoryManager();
  
  let provider;
  try {
     provider = new GroqProvider();
  } catch (e) {
     UI.error(`Provider Error: ${e.message}`);
     process.exit(1);
  }

  const contextMgr = new ContextManager();
  const reflection = new ReflectionSystem(provider);
  const orchestrator = new Orchestrator(provider, executor, memory, null, reflection, contextMgr);

  console.clear();
  console.log(chalk.bold.magenta("====================================================="));
  console.log(chalk.bold.magenta("     TERMUX ELITE AUTONOMOUS AGENT (OS LAYER)"));
  console.log(chalk.bold.magenta("====================================================="));
  UI.system("Core Systems Online. Memory/Process Guard Active.");
  UI.system("Type /help for slash commands.");
  
  const spinner = ora('Agent initializing...').stop();
  
  bus.on(EVENTS.STATE_CHANGE, (state) => {
    spinner.text = `System State: ${chalk.yellow(state)}`;
    if (['IDLE', 'COMPLETED', 'FAILED'].includes(state)) {
       spinner.stop();
    } else if (!spinner.isSpinning) {
       spinner.start();
    }
  });

  bus.on(EVENTS.THINKING_START, () => { spinner.text = chalk.cyan('Thinking / Generating...'); });
  bus.on(EVENTS.THINKING_END, () => { spinner.text = chalk.yellow('Processing...'); });
  bus.on(EVENTS.ROLLBACK_START, ({file}) => UI.system(`Rolling back ${file}...`));
  bus.on(EVENTS.SYSTEM_ERROR, (err) => UI.error(err.message));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  bus.emit(EVENTS.SESSION_START);

  while (true) {
    const input = await question(`\n${chalk.green('agent> ')}`);
    const cmd = input.trim();
    if (!cmd) continue;

    if (cmd.startsWith('/')) {
      const lower = cmd.toLowerCase();
      if (lower === '/exit') break;
      if (lower === '/clear') {
        memory.clear();
        UI.success("Memory cleared.");
        continue;
      }
      if (lower === '/stats') {
        UI.system(`Telemetry Data:\n${JSON.stringify(telemetry.stats, null, 2)}`);
        continue;
      }
      if (lower === '/help') {
        UI.system("Commands: /exit, /clear, /stats, /help, /modelchange <model_id>");
        continue;
      }
      if (lower.startsWith('/modelchange')) {
        const parts = cmd.trim().split(/\s+/);
        const modelId = parts[1];
        if (!modelId) {
          UI.error("Usage: /modelchange <model_id>  (e.g. /modelchange llama-3.1-8b-instant)");
          UI.system(`Current model: ${provider.getModel()}`);
        } else {
          provider.setModel(modelId);
          UI.success(`Model changed to: ${modelId}`);
        }
        continue;
      }
    }

    try {
      await orchestrator.runObjective(cmd);
    } catch (e) {
      UI.error(`Fatal Loop Error: ${e.message}`);
    }
  }

  bus.emit(EVENTS.SESSION_END);
  UI.system("Graceful shutdown.");
  rl.close();
}