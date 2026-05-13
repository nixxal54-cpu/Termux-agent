import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';

import { Sandbox } from './core/sandbox.js';
import { Executor } from './core/executor.js';
import { MemoryManager } from './core/memory.js';
import { Orchestrator } from './core/orchestrator.js';
import { ContextManager } from './core/context_manager.js';
import { ReflectionSystem } from './core/reflection.js';
import { GeminiProvider } from './providers/gemini.js';
import { GroqProvider } from './providers/groq.js';
import { bus, EVENTS } from './core/event_bus.js';

import { shellTool } from './tools/shell/index.js';
import { filesTool } from './tools/files/index.js';
import { searchTool } from './tools/search/index.js';
import { patchTool } from './tools/patch/index.js';
import { gitTool } from './tools/git.js';
import { webTool } from './tools/web.js';
import { systemTool } from './tools/system/index.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Workspace ──────────────────────────────────────────────────────────────
// The web UI has no folder picker — use a dedicated workspace dir.
// Override with WORKSPACE_DIR env var if needed.
const WORKSPACE_DIR = path.resolve(
  process.env.WORKSPACE_DIR ||
  path.join(process.cwd(), 'workspace')
);
await fs.ensureDir(WORKSPACE_DIR);

// ── SSE client registry ────────────────────────────────────────────────────
// runId → res  (one entry per open browser tab)
const clients = new Map();

function emit(runId, data) {
  const res = clients.get(runId);
  if (res) res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ── Active run registry ────────────────────────────────────────────────────
const activeRuns = new Map(); // runId → { abort: AbortController }

// ── 1. SSE stream endpoint ─────────────────────────────────────────────────
// Frontend opens this BEFORE /run so it never misses the first events.
// Server sends back a unique runId the frontend must include in the /run body.
app.get('/stream', (req, res) => {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'init', runId })}\n\n`);
  clients.set(runId, res);

  req.on('close', () => {
    clients.delete(runId);
    const run = activeRuns.get(runId);
    if (run) run.abort.abort();
  });
});

// ── 2. Run endpoint ────────────────────────────────────────────────────────
app.post('/run', async (req, res) => {
  const { task, provider: providerName, model, runId } = req.body;

  if (!task || !runId) {
    return res.status(400).json({ error: 'task and runId are required' });
  }
  if (!clients.has(runId)) {
    return res.status(400).json({ error: `No active SSE stream for runId: ${runId}. Open /stream first.` });
  }
  if (activeRuns.has(runId)) {
    return res.status(409).json({ error: 'A run is already in progress for this session.' });
  }

  // Respond immediately — the real output comes via SSE
  res.json({ status: 'started', runId });

  // ── Build provider ───────────────────────────────────────────────────────
  let provider;
  try {
    if (providerName === 'gemini') {
      provider = new GeminiProvider({ model: model || 'gemini-2.0-flash' });
    } else {
      provider = new GroqProvider({ model: model || 'llama-3.3-70b-versatile' });
    }
  } catch (e) {
    emit(runId, { type: 'state', state: 'FAILED' });
    emit(runId, { type: 'thought', text: `Provider init failed: ${e.message}`, state: 'FAILED' });
    emit(runId, { type: 'done' });
    return;
  }

  // ── Build agent stack ────────────────────────────────────────────────────
  const sandbox      = new Sandbox(WORKSPACE_DIR);
  const executor     = new Executor(
    [shellTool, filesTool, searchTool, patchTool, gitTool, webTool, systemTool],
    sandbox
  );
  const memory       = new MemoryManager();
  const contextMgr   = new ContextManager();
  const reflection   = new ReflectionSystem(provider);
  const orchestrator = new Orchestrator(provider, executor, memory, null, reflection, contextMgr);

  // ── Wire event bus → SSE ─────────────────────────────────────────────────
  // Stored as a map so we can call bus.off on every handler when the run ends
  const handlers = {
    [EVENTS.STATE_CHANGE]: (state) => {
      emit(runId, { type: 'state', state });
    },

    [EVENTS.THINKING_START]: () => {
      emit(runId, { type: 'thought', text: 'Thinking and planning next action...', state: 'PLANNING' });
    },

    [EVENTS.TOOL_EXECUTE]: ({ tool, args }) => {
      const argKey = Object.keys(args || {})[0] || 'args';
      const argVal = String(args?.[argKey] ?? '').slice(0, 120);
      emit(runId, { type: 'tool', tool, action: 'execute', argKey, argVal });
    },

    [EVENTS.TOOL_RESULT]: ({ tool, result }) => {
      const preview = result?.stdout
        || result?.content
        || result?.result
        || result?.message
        || result?.summary
        || '';
      emit(runId, {
        type: 'thought',
        text: `[${tool}] → ${String(preview).slice(0, 200)}`,
        state: 'OBSERVING',
      });
    },

    [EVENTS.REFLECTION_RESULT]: (reflectionAdvice) => {
      const advice = reflectionAdvice?.advice || reflectionAdvice;
      if (advice) {
        emit(runId, { type: 'thought', text: `Reflection: ${advice}`, state: 'REFLECTING' });
      }
    },

    [EVENTS.SYSTEM_ERROR]: (err) => {
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      emit(runId, { type: 'thought', text: `⚠ ${msg}`, state: 'RECOVERING' });
    },
  };

  for (const [event, handler] of Object.entries(handlers)) {
    bus.on(event, handler);
  }

  // ── Track run for cancel support ─────────────────────────────────────────
  const abort = new AbortController();
  activeRuns.set(runId, { abort });

  // ── Execute ───────────────────────────────────────────────────────────────
  try {
    await orchestrator.runObjective(task);

    const finalState = orchestrator.stateMachine.getState();
    if (finalState !== 'COMPLETED' && finalState !== 'FAILED') {
      emit(runId, { type: 'state', state: 'COMPLETED' });
    }
    emit(runId, { type: 'thought', text: 'Task finished. Awaiting next command.', state: 'COMPLETED' });
  } catch (e) {
    emit(runId, { type: 'state', state: 'FAILED' });
    emit(runId, { type: 'thought', text: `Fatal error: ${e.message}`, state: 'FAILED' });
  } finally {
    emit(runId, { type: 'done' });
    for (const [event, handler] of Object.entries(handlers)) {
      bus.off(event, handler);
    }
    activeRuns.delete(runId);
  }
});

// ── 3. Cancel endpoint ─────────────────────────────────────────────────────
app.post('/cancel', (req, res) => {
  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId required' });

  const run = activeRuns.get(runId);
  if (!run) return res.status(404).json({ error: 'No active run for this runId' });

  run.abort.abort();
  emit(runId, { type: 'state', state: 'FAILED' });
  emit(runId, { type: 'thought', text: 'Run cancelled by user.', state: 'FAILED' });
  emit(runId, { type: 'done' });
  activeRuns.delete(runId);

  res.json({ status: 'cancelled' });
});

// ── 4. Health check ────────────────────────────────────────────────────────
app.get('/status', (_req, res) => {
  res.json({ status: 'online', workspace: WORKSPACE_DIR, activeRuns: activeRuns.size });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`CodingAgent backend live: http://localhost:${port}`));
