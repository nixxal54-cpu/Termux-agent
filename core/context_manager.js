import { TokenBudgetEngine } from './token_budget.js';
import { bus, EVENTS } from './event_bus.js';

export class ContextManager {
  constructor() {
    this.budget = new TokenBudgetEngine();
    // Conservative limit — leaves room for system prompt + schemas (~3k tokens)
    this.MAX_HISTORY_TOKENS = 6000;
    // Max chars for any single tool result kept in history
    this.MAX_TOOL_RESULT_CHARS = 800;
  }

  _compressContent(content) {
    if (!content) return content;
    // Aggressively truncate tool results stored in history — they bloat context fast
    // Tool results look like: "Tool Result: {...}"
    return content.replace(
      /(Tool Result:|Tool Failed:)\s*(\{[\s\S]*?\})/g,
      (match, prefix, json) => {
        if (json.length > this.MAX_TOOL_RESULT_CHARS) {
          return `${prefix} ${json.substring(0, this.MAX_TOOL_RESULT_CHARS)}... [truncated]`;
        }
        return match;
      }
    );
  }

  async optimize(history) {
    let totalTokens = 0;
    const optimized = [];

    // Always keep first user message (the original task)
    if (history.length > 0) {
      optimized.push(history[0]);
      totalTokens += this.budget.estimateTokens(history[0].content);
    }

    // Walk from newest to oldest, compress tool results as we go
    const recent = [];
    for (let i = history.length - 1; i > 0; i--) {
      const msg = history[i];
      const compressed = {
        ...msg,
        content: this._compressContent(msg.content)
      };
      const tokens = this.budget.estimateTokens(compressed.content);

      if (totalTokens + tokens > this.MAX_HISTORY_TOKENS) {
        bus.emit(EVENTS.CONTEXT_COMPRESSED, { skippedTokens: tokens });
        break;
      }
      recent.unshift(compressed);
      totalTokens += tokens;
    }

    if (history.length - 1 > recent.length) {
      optimized.push({
        role: 'system',
        content: `[${history.length - 1 - recent.length} earlier messages omitted to stay within token limit]`
      });
    }

    return optimized.concat(recent);
  }
}