import simpleGit from 'simple-git';

export const gitTool = {
  name: "git_tool",
  description: "Perform git operations: status, diff, log, commit, add. Helpful for version control operations.",
  schema: {
    action: "status|diff|log|commit|add",
    message: "string (required for commit)",
    files: "string (required for add, e.g. '.')"
  },
  execute: async (args, context) => {
    // Use sandbox workspace root so git runs in the correct project directory
    const git = simpleGit(context.workspace.rootDir);
    try {
      switch (args.action) {
        case 'status':
          const status = await git.status();
          return { status: "success", result: status };
        case 'diff':
          const diff = await git.diff();
          return { status: "success", result: diff };
        case 'log':
          const log = await git.log({ maxCount: 5 });
          return { status: "success", result: log.all };
        case 'add':
          await git.add(args.files || '.');
          return { status: "success", message: "Files added" };
        case 'commit':
          if (!args.message) throw new Error("Commit message required");
          const commit = await git.commit(args.message);
          return { status: "success", result: commit };
        default:
          return { status: "error", message: "Unknown action" };
      }
    } catch (error) {
      return { status: "error", message: error.message };
    }
  }
};