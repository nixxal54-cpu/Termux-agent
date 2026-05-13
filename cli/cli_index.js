import readline from 'readline';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { Sandbox } from '../core/sandbox.js';
import { Executor } from '../core/executor.js';
import { MemoryManager } from '../core/memory.js';
import { Orchestrator } from '../core/orchestrator.js';
import { ContextManager } from '../core/context_manager.js';
import { ReflectionSystem } from '../core/reflection.js';
import { GroqProvider } from '../providers/groq.js';
import { GeminiProvider, GEMINI_MODELS } from '../providers/gemini.js';
import { Telemetry } from '../core/telemetry.js';
import { Logger } from '../core/logger.js';
import { UI } from '../utils/formatter.js';
import { shellTool } from '../tools/shell/index.js';
import { filesTool } from '../tools/files/index.js';
import { searchTool } from '../tools/search/index.js';
import { patchTool } from '../tools/patch/index.js';
import { gitTool } from '../tools/git.js';
import { webTool } from '../tools/web.js';
import { bus, EVENTS } from '../core/event_bus.js';

async function selectProjectFolder(question) {
  console.log(chalk.bold.cyan('\n📁 PROJECT FOLDER SELECTION'));
  console.log(chalk.dim('The agent will only read/write inside this folder.\n'));

  while (true) {
    const input = await question(chalk.yellow('Enter project folder path (or press Enter to create a new one): '));
    const trimmed = input.trim();

    // Default: create a new timestamped project folder next to agent
    if (!trimmed) {
      const defaultPath = path.join(process.env.HOME || '/data/data/com.termux/files/home', 'projects', `project_${Date.now()}`);
      await fs.ensureDir(defaultPath);
      UI.success(`Created new project folder: ${defaultPath}`);
      return defaultPath;
    }

    // Expand ~ manually
    const expanded = trimmed.startsWith('~')
      ? trimmed.replace('~', process.env.HOME || '/data/data/com.termux/files/home')
      : trimmed;

    const resolved = path.resolve(expanded);

    // Safety: block the agent's own directory
    const agentDir = path.resolve(process.cwd());
    if (resolved === agentDir || resolved.startsWith(agentDir + path.sep)) {
      UI.error(`Cannot use the agent's own directory as a project folder.`);
      UI.error(`Agent lives at: ${agentDir}`);
      UI.system('Please choose a different folder.');
      continue;
    }

    if (await fs.pathExists(resolved)) {
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory()) {
        UI.error(`That path is a file, not a folder. Please enter a directory path.`);
        continue;
      }
      UI.success(`Using existing folder: ${resolved}`);
      return resolved;
    } else {
      const confirm = await question(chalk.yellow(`Folder doesn't exist. Create it? (y/n): `));
      const answer = confirm.trim().toLowerCase();
      if (answer === 'y') {
        await fs.ensureDir(resolved);
        UI.success(`Created: ${resolved}`);
        return resolved;
      } else if (answer !== 'n') {
        // User may have accidentally typed a path instead of y/n — just re-loop
        UI.error(`Please type y or n.`);
      }
    }
  }
}

export async function runCLI() {
  const logger = new Logger();
  await logger.init();

  const telemetry = new Telemetry();
  await telemetry.init();

  console.clear();
  console.log(chalk.bold.magenta("====================================================="));
  console.log(chalk.bold.magenta("     TERMUX ELITE AUTONOMOUS AGENT (OS LAYER)"));
  console.log(chalk.bold.magenta("====================================================="));

  // Set up readline early so we can use it for project folder selection
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  // Prevent readline from closing when stdin briefly emits 'end' during spinner
  rl.on('close', () => {});

  const question = (query) => new Promise(resolve => {
    rl.resume(); // Always reclaim stdin before prompting
    rl.question(query, resolve);
  });

  // --- Project folder selection ---
  let projectDir = await selectProjectFolder(question);
  console.log(chalk.bold.green(`\n🗂  Workspace: ${projectDir}\n`));

  let sandbox = new Sandbox(projectDir);
  let executor = new Executor([shellTool, filesTool, searchTool, patchTool, gitTool, webTool], sandbox);
  const memory = new MemoryManager();

  // --- Provider selection ---
  console.log(chalk.bold.cyan('\n🤖 SELECT AI PROVIDER'));
  console.log(chalk.dim('  1. Groq   (requires GROQ_API_KEY)'));
  console.log(chalk.dim('  2. Gemini (requires GEMINI_API_KEY — free tier available)\n'));

  let providerChoice = '';
  while (!['1', '2', 'groq', 'gemini'].includes(providerChoice.toLowerCase())) {
    providerChoice = await question(chalk.yellow('Enter provider (1/groq or 2/gemini): '));
    providerChoice = providerChoice.trim();
  }
  const useGemini = providerChoice === '2' || providerChoice.toLowerCase() === 'gemini';

  let provider;
  if (useGemini) {
    console.log(chalk.bold.cyan('\n🔮 SELECT GEMINI MODEL'));
    GEMINI_MODELS.forEach((m, i) => console.log(chalk.dim(`  ${i + 1}. ${m.label}`)));
    const modelInput = await question(chalk.yellow(`\nEnter number or model ID [default: gemini-2.0-flash]: `));
    const trimmed = modelInput.trim();
    let geminiModel = 'gemini-2.0-flash';
    if (trimmed) {
      const idx = parseInt(trimmed, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= GEMINI_MODELS.length) {
        geminiModel = GEMINI_MODELS[idx - 1].id;
      } else {
        geminiModel = trimmed;
      }
    }
    try {
      provider = new GeminiProvider({ model: geminiModel });
      UI.success(`Gemini provider ready — model: ${geminiModel}`);
    } catch (e) {
      UI.error(`Gemini Provider Error: ${e.message}`);
      process.exit(1);
    }
  } else {
    try {
      provider = new GroqProvider();
      UI.success(`Groq provider ready — model: ${provider.getModel()}`);
    } catch (e) {
      UI.error(`Groq Provider Error: ${e.message}`);
      process.exit(1);
    }
  }

  const contextMgr = new ContextManager();
  const reflection = new ReflectionSystem(provider);
  let orchestrator = new Orchestrator(provider, executor, memory, null, reflection, contextMgr);

  UI.system("Core Systems Online. Memory/Process Guard Active.");
  UI.system("Type /help for slash commands.");

  const spinner = ora({
    text: 'Agent initializing...',
    discardStdin: false  // CRITICAL: prevents ora from stealing/discarding stdin input
  }).stop();

  bus.on(EVENTS.STATE_CHANGE, (state) => {
    spinner.text = `System State: ${chalk.yellow(state)}`;
    if (['IDLE', 'COMPLETED', 'FAILED'].includes(state)) {
      spinner.stop();
      rl.resume(); // Reclaim stdin after spinner stops
    } else if (!spinner.isSpinning) {
      spinner.start();
    }
  });

  bus.on(EVENTS.THINKING_START, () => { spinner.text = chalk.cyan('Thinking / Generating...'); });
  bus.on(EVENTS.THINKING_END, () => { spinner.text = chalk.yellow('Processing...'); });
  bus.on(EVENTS.ROLLBACK_START, ({ file }) => UI.system(`Rolling back ${file}...`));
  bus.on(EVENTS.SYSTEM_ERROR, (err) => UI.error(err.message));

  bus.emit(EVENTS.SESSION_START);

  while (true) {
    // Small pause to let spinner fully stop and stdout flush before re-prompting
    await new Promise(resolve => setTimeout(resolve, 150));
    rl.resume();

    const input = await question(`\n${chalk.green('agent> ')}`);
    const cmd = input.trim();

    // Skip empty input — never exit on blank line
    if (!cmd) continue;

    // Guard: detect shell prompt bleed (e.g. "$ " or "~/path $" artifacts)
    if (cmd === '$' || cmd.endsWith('$ ') || cmd.startsWith('~/')) {
      continue;
    }

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
      if (lower === '/folder') {
        UI.system(`Current project folder: ${projectDir}`);
        continue;
      }
      if (lower === '/changefolder') {
        const newDir = await selectProjectFolder(question);
        projectDir = newDir;
        sandbox = new Sandbox(newDir);
        executor = new Executor([shellTool, filesTool, searchTool, patchTool, gitTool, webTool], sandbox);
        orchestrator = new Orchestrator(provider, executor, memory, null, reflection, contextMgr);
        console.log(chalk.bold.green(`\n🗂  Workspace changed to: ${newDir}\n`));
        continue;
      }
      if (lower === '/help') {
        UI.system(
          "Commands:\n" +
          "  /help                           — show this list\n" +
          "  /clear                          — wipe session memory\n" +
          "  /stats                          — show telemetry\n" +
          "  /folder                         — show current project folder\n" +
          "  /changefolder                   — switch to a different project folder\n" +
          "  /modelchange <model_id>         — switch LLM model\n" +
          "  /provider <groq|gemini> [model] — switch AI provider at runtime\n" +
          "  /exit                           — quit"
        );
        continue;
      }
      if (lower.startsWith('/provider')) {
        const parts = cmd.trim().split(/\s+/);
        const newProvider = parts[1]?.toLowerCase();
        const newModel = parts[2];
        if (!newProvider || !['groq', 'gemini'].includes(newProvider)) {
          UI.error('Usage: /provider <groq|gemini> [model_id]');
          continue;
        }
        const defaultModel = newProvider === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile';
        const targetModel = newModel || defaultModel;
        try {
          if (newProvider === 'gemini') {
            provider = new GeminiProvider({ model: targetModel });
          } else {
            provider = new GroqProvider({ model: targetModel });
          }
          const reflection2 = new ReflectionSystem(provider);
          orchestrator = new Orchestrator(provider, executor, memory, null, reflection2, contextMgr);
          UI.success(`Switched to ${newProvider.toUpperCase()} [${targetModel}]`);
        } catch (e) {
          UI.error(`Provider switch failed: ${e.message}`);
        }
        continue;
      }
      if (lower.startsWith('/modelchange')) {
        const parts = cmd.trim().split(/\s+/);
        const modelId = parts[1];
        if (!modelId) {
          UI.error("Usage: /modelchange <model_id>  (e.g. /modelchange llama-3.3-70b-versatile)");
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
      // Give stdout time to flush and spinner to fully stop before next prompt
      await new Promise(resolve => setTimeout(resolve, 200));
      rl.resume();
    } catch (e) {
      UI.error(`Fatal Loop Error: ${e.message}`);
      await new Promise(resolve => setTimeout(resolve, 200));
      rl.resume();
    }
  }

  bus.emit(EVENTS.SESSION_END);
  UI.system("Graceful shutdown.");
  rl.close();
}