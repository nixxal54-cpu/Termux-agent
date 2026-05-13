export class ResilientParser {
  static parseJSON(text) {
    try {
      // 1. Try directly
      return JSON.parse(text);
    } catch (e1) {
      // 2. Strip Markdown JSON blocks
      try {
        const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch && markdownMatch[1]) {
           return JSON.parse(markdownMatch[1]);
        }
      } catch (e2) {}

      // 3. Fallback heuristic: Try to find first { and last }
      try {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
           const substr = text.substring(firstBrace, lastBrace + 1);
           return JSON.parse(substr);
        }
      } catch(e3) {}

      // 4. Return null so orchestrator handles the RECOVERY parse state
      return null;
    }
  }
}
