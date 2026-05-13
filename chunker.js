export function chunkText(text, maxTokens = 2000) {
  // A simple chunker based on characters assuming ~4 chars per token.
  const maxLength = maxTokens * 4;
  const chunks = [];
  let currentPos = 0;

  while (currentPos < text.length) {
    let endPos = currentPos + maxLength;
    if (endPos < text.length) {
      const lastNewline = text.lastIndexOf('\n', endPos);
      if (lastNewline > currentPos) {
        endPos = lastNewline;
      }
    }
    chunks.push(text.slice(currentPos, endPos));
    currentPos = endPos;
  }
  
  return chunks;
}
