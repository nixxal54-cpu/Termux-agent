import fs from 'fs-extra';
import path from 'path';
import { bus, EVENTS } from './event_bus.js';

export class Logger {
  constructor(config = {}) {
    this.logDir = config.logDir || path.join(process.cwd(), 'storage');
    this.logFile = path.join(this.logDir, 'system.log');
  }

  async init() {
    await fs.ensureDir(this.logDir);
    this.info('Logger initialized');
    
    // Subscribe to events for structured logging
    bus.on(EVENTS.SYSTEM_ERROR, (err) => this.error('System Error', err));
    bus.on(EVENTS.TOOL_EXECUTE, (data) => this.debug('Tool Executing', data));
    bus.on(EVENTS.TOOL_RESULT, (data) => this.debug('Tool Result', data));
  }

  async _write(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logLine = JSON.stringify({ timestamp, level, message, ...meta }) + '\\n';
    try {
      await fs.appendFile(this.logFile, logLine);
    } catch (e) {
      console.error("Logger failed to write:", e.message);
    }
  }

  info(msg, meta) { this._write('INFO', msg, meta); }
  error(msg, err) { 
    this._write('ERROR', msg, { 
      message: err.message, 
      stack: err.stack,
      ...err.meta 
    }); 
  }
  warn(msg, meta) { this._write('WARN', msg, meta); }
  debug(msg, meta) { 
    if(process.env.DEBUG === 'true') {
      this._write('DEBUG', msg, meta); 
    }
  }
}
