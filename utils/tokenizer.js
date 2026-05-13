export function estimateTokens(text) {
  // Rough estimate: 1 token = ~4 characters
  return Math.ceil((text || '').length / 4);
}
