export class MemoryManager {
  constructor(config = {}) {
    this.history = [];
    this.maxMessages = config.maxHistoryLimit || 30;
    this.projectContext = new Map();
  }

  addMessage(messageObj) {
    this.history.push(messageObj);
    if (this.history.length > this.maxMessages) {
      // Always keep index 0 (initial user prompt) and the most recent messages.
      // Insert a marker so the LLM knows context was trimmed — silent drops cause confusion.
      const keepTail = Math.floor(this.maxMessages * 0.8);
      const dropped = this.history.length - 1 - keepTail;
      if (dropped > 0) {
        this.history.splice(1, dropped, {
          role: 'system',
          content: `[${dropped} earlier messages were trimmed to stay within memory limits.]`
        });
      }
    }
  }

  getMessages() {
    return this.history;
  }

  clear() {
    this.history = [];
  }

  trimToRecent(keepCount = 5) {
    if (this.history.length <= keepCount + 1) return;
    const first = this.history[0];
    const recent = this.history.slice(-keepCount);
    this.history = [first, { role: 'system', content: `[Earlier messages trimmed due to token limit]` }, ...recent];
  }

  saveProjectFact(key, value) {
    this.projectContext.set(key, value);
  }

  getProjectFacts() {
    let facts = [];
    for (const [k, v] of this.projectContext.entries()) {
      facts.push(`${k}: ${v}`);
    }
    return facts.join('\\n');
  }
}