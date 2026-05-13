export class TokenBudgetEngine {
  constructor() {
    this.MAX_CONTEXT_TOKENS = 64000; // E.g., Llama 3.3 70B can handle 128k, but we budget 64k
    this.CHAR_TO_TOKEN_RATIO = 4.0;
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / this.CHAR_TO_TOKEN_RATIO);
  }

  truncateOutput(text, maxTokens = 2000) {
    if (!text) return "";
    const currentTokens = this.estimateTokens(text);
    if (currentTokens <= maxTokens) return text;
    
    const charsAllowed = Math.floor(maxTokens * this.CHAR_TO_TOKEN_RATIO);
    return text.substring(0, charsAllowed) + `\n\n... [TRUNCATED - output exceeded ${maxTokens} tokens] ...`;
  }
}
