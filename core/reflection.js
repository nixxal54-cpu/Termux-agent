export class ReflectionSystem {
  constructor(provider) {
    this.provider = provider;
  }

  async analyzeFailure(action, result) {
    let advice = null;
    let requiresRollback = false;
    
    // Fast rule-based checks first (no LLM cost for common known errors)
    if (action.tool === 'execute_shell' || action.tool === 'process') {
      const stderr = (result.stderr || '').toLowerCase();
      if (stderr.includes('not found') || stderr.includes('no such file')) {
         advice = "Command or file not found. Check path or install dependency via pkg/apt/npm.";
      } else if (stderr.includes('permission denied')) {
         advice = "Permission denied. Check Android/Termux access rights.";
      } else if (stderr.includes('syntax error')) {
         advice = "Syntax error in execution. Rewrite the command carefully.";
      } else if (result.status === 'timeout') {
         advice = "Process timed out. Ensure the command does not prompt for user input recursively or hang interactively.";
      }
    } else if (action.tool === 'files') {
      if (result.message && result.message.includes('not found')) {
        advice = "File or directory not found. Use 'files' with action:'list' to confirm the path first.";
      } else if (result.message && result.message.includes('Security Violation')) {
        advice = "Path is outside the sandbox. Only use relative paths within the project workspace.";
      }
    } else if (action.tool === 'search') {
      if (result.status === 'not_found') {
        advice = "Search returned no results. Try a shorter or more general query, or use action:'file' to search by filename instead.";
      }
    } else if (action.tool === 'git_tool') {
      if (result.message && result.message.includes('not a git repository')) {
        advice = "The workspace is not a git repository. Run execute_shell with 'git init' first.";
      } else if (result.message && result.message.includes('nothing to commit')) {
        advice = "Nothing to commit — working tree is clean. Use git_tool status to verify changes exist.";
      }
    } else if (action.tool === 'web') {
      if (result.message && result.message.includes('timed out')) {
        advice = "Web request timed out. Try a different URL or a simpler search query.";
      } else if (result.message && result.message.includes('Too many redirects')) {
        advice = "URL has too many redirects. Try the direct canonical URL.";
      }
    } else if (action.tool === 'patch_file') {
      requiresRollback = true;
      if (result.message && result.message.includes('Search string not found')) {
        advice = "Patch failed because the search block wasn't exactly matched. DO NOT GUESS. Use search/files tool to read the EXACT literal string before patching.";
      } else if (result.message && result.message.includes('Verification failed')) {
        advice = "Patch broke syntax. Rolled back. Please provide a structurally valid patch without missing brackets or syntax errors.";
      }
    }

    // For unrecognized failures, ask the LLM to reason about them
    if (!advice) {
      try {
        const prompt = `You are a debugging expert for a Termux/Android coding agent.
A tool call failed. Analyze the failure and give a single, concise, actionable recovery suggestion (1-2 sentences max).

Tool: ${action.tool}
Args: ${JSON.stringify(action.args)}
Result: ${JSON.stringify(result)}

Respond ONLY with a JSON object: { "advice": "your recovery suggestion here", "requiresRollback": true/false }`;

        const raw = await this.provider.generate([{ role: 'user', content: prompt }]);
        // Strip markdown fences if present
        const clean = raw.replace(/```(?:json)?|```/g, '').trim();
        const parsed = JSON.parse(clean);
        advice = parsed.advice || "Re-evaluate your approach. Use search/files to get more context.";
        requiresRollback = parsed.requiresRollback ?? requiresRollback;
      } catch (e) {
        advice = "Re-evaluate your approach. Use search/files to get more context.";
      }
    }

    return { advice, requiresRollback };
  }
}
