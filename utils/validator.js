export function parseJSONAction(content) {
  try {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

export function isDangerousCommand(command) {
  const dangerousPatterns = [
    /rm\s+-rf\s+\/$/,
    /rm\s+-rf\s+\/\*/,
    /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    />\s*\/dev\/[a-z]+/,
    /chmod\s+-R\s+777\s+\//
  ];
  return dangerousPatterns.some(pattern => pattern.test(command));
}