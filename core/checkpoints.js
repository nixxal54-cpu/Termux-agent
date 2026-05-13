import fs from 'fs-extra';
import { bus, EVENTS } from './event_bus.js';

export class CheckpointSystem {
  constructor() {
    this.snapshots = new Map();
  }

  async createCheckpoint(filePath) {
    bus.emit(EVENTS.CHECKPOINT_CREATE, { file: filePath });
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      if (!this.snapshots.has(filePath)) {
        this.snapshots.set(filePath, []);
      }
      this.snapshots.get(filePath).push({ content, timestamp: Date.now() });
    }
  }

  async rollback(filePath) {
    bus.emit(EVENTS.ROLLBACK_START, { file: filePath });
    const history = this.snapshots.get(filePath);
    if (history && history.length > 0) {
       const lastState = history.pop(); // Revert to last
       await fs.writeFile(filePath, lastState.content, 'utf8');
       bus.emit(EVENTS.ROLLBACK_COMPLETE, { file: filePath });
       return true;
    }
    return false;
  }
  
  clear(filePath) {
    this.snapshots.delete(filePath);
  }
}

export const checkpointSys = new CheckpointSystem();
