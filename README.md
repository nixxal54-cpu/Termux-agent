# Termux Autonomous Coding Agent

An elite, production-grade, highly reliable AI terminal coding assistant optimized for Android/Termux, low memory footprints, and extreme network instability.

## Elite Features
- **State Machine Orchestrator:** Fragile while-loops have been entirely eradicated in favor of formal execution states (`ANALYZING`, `PLANNING`, `EXECUTING`, `REFLECTING`, `VERIFYING`, `RETRYING`).
- **Resilient Execution Engine:** `shelljs` has been removed. All processes use `child_process.spawn` with stdout/stderr streaming, memory isolation, structured JSON parsers, and explicit token budgeting to prevent history explosion.
- **Self-Healing Reflection:** When tools crash (e.g. out of memory, missing dependencies), the Orchestrator flips into `REFLECTING` state to parse `stderr` and formulate an automatic alternate path without needing user intervention.
- **Patch-Based Edits:** Replaces dangerous destructive rewrites with targeted inline edits (`tools/patch`).
- **Centralized Event Bus:** Absolute observability. Deep integrations with `ora` tracking telemetry, state changes, memory compression metrics, and token budgets.
- **Strict Sandboxing:** Explicit path traversal blocks for Android filesystem safety.

## Run on Android Termux
1. `npm install`
2. `cp .env.example .env` and setup `GROQ_API_KEY=your_key`
3. `node index.js`
4. Interact using the CLI interface.

## Slash Commands
- `/help`: Show commands
- `/stats`: Show real-time telemetry (token usage, completed tasks)
- `/clear`: Wipe session memory 
- `/exit`: Shut down gracefully

## Architecture Layout
- `core/`: 
  - `orchestrator.js` -> The State Machine orchestrator
  - `state_machine.js` -> State transitions
  - `event_bus.js` -> Application-wide message bus
  - `context_manager.js` -> Token history compressor
  - `token_budget.js` -> Sliding window limit calculation 
  - `parser.js` -> Malformed JSON healer
- `tools/`: 
  - `shell/` -> Sandboxed stream-based execution
  - `patch/` -> Destructive-free targeted edits
- `providers/`: Groq REST HTTP client featuring automatic 429 back-off handling.
