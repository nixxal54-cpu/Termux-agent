import fs from 'fs-extra';
import path from 'path';
import { bus, EVENTS } from './event_bus.js';

export class Telemetry {
  constructor(config = {}) {
    this.storageDir = config.storageDir || path.join(process.cwd(), 'storage');
    this.statsFile = path.join(this.storageDir, 'telemetry.json');
    this.stats = {
      totalTokens: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      toolCalls: {},
      sessionStartTime: Date.now()
    };
  }

  async init() {
    await fs.ensureDir(this.storageDir);
    try {
      if (await fs.pathExists(this.statsFile)) {
        const data = await fs.readFile(this.statsFile, 'utf8');
        this.stats = { ...this.stats, ...JSON.parse(data), sessionStartTime: Date.now() };
      }
    } catch (e) {
      // ignore parse errors and start fresh
    }

    bus.on(EVENTS.TOKEN_USAGE, (usage) => this.trackTokens(usage));
    bus.on(EVENTS.TOOL_EXECUTE, (data) => this.trackToolCall(data));
    bus.on(EVENTS.TASK_COMPLETE, () => this.trackTask(true));
    bus.on(EVENTS.TASK_FAILED, () => this.trackTask(false));
    
    // Periodically save
    setInterval(() => this.save(), 60000).unref();
  }

  trackTokens({ promptTokens = 0, completionTokens = 0 }) {
    this.stats.totalTokens += (promptTokens + completionTokens);
  }

  trackToolCall({ tool }) {
    if (!this.stats.toolCalls[tool]) this.stats.toolCalls[tool] = 0;
    this.stats.toolCalls[tool]++;
  }

  trackTask(success) {
    if (success) this.stats.tasksCompleted++;
    else this.stats.tasksFailed++;
    this.save();
  }

  async save() {
    try {
      await fs.writeFile(this.statsFile, JSON.stringify(this.stats, null, 2));
    } catch (e) {
      // suppress isolated save errors
    }
  }
}
