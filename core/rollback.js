import fs from 'fs-extra';
import { bus, EVENTS } from './event_bus.js';

export class RollbackSystem {
  constructor() {
    this.memory = new Map();
  }

  async createCheckpoint(filePath) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      this.memory.set(filePath, content);
    }
  }

  async rollback(filePath) {
    if (this.memory.has(filePath)) {
       const original = this.memory.get(filePath);
       await fs.writeFile(filePath, original, 'utf8');
       bus.emit(EVENTS.SYSTEM_STATUS, { message: `Rollback completed for ${filePath}` });
       return true;
    }
    return false;
  }

  clear(filePath) {
    this.memory.delete(filePath);
  }
}

export const rollbackSys = new RollbackSystem();
