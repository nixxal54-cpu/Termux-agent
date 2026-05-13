import shell from 'shelljs';

export const searchTool = {
  name: "search_tool",
  description: "Search for text within files or search for filenames across the project. Uses grep and find.",
  schema: {
    action: "grep|find",
    query: "string",
    dir: "string (optional, defaults to .)"
  },
  execute: async (args) => {
    const dir = args.dir || '.';
    if (args.action === 'grep') {
      const cmd = `grep -rnI "${args.query}" ${dir} --exclude-dir=node_modules --exclude-dir=.git`;
      const res = shell.exec(cmd, { silent: true });
      return { status: res.code === 0 ? "success" : "not_found", result: res.stdout };
    } else if (args.action === 'find') {
      const cmd = `find ${dir} -name "*${args.query}*" -not -path "*/node_modules/*" -not -path "*/.git/*"`;
      const res = shell.exec(cmd, { silent: true });
      return { status: res.code === 0 ? "success" : "not_found", result: res.stdout };
    }
    return { status: 'error', message: 'Invalid search action' };
  }
};
