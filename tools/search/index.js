import { spawn } from 'child_process';

function runSpawn(cmd, argsList, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, argsList, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    
    child.on('close', code => {
      resolve({ code, stdout, stderr });
    });
    child.on('error', err => {
      resolve({ code: -1, stderr: err.message, stdout: '' });
    });
  });
}

export const searchTool = {
  name: "search",
  description: "Search for text inside files or search filenames. Respects gitignore and ignores node_modules.",
  schema: {
    type: "'text' or 'file'",
    query: "string"
  },
  execute: async (args, context) => {
    const cwd = context.workspace.rootDir;
    
    if (args.type === 'text') {
      // grep -rnI "query" .
      const res = await runSpawn('grep', ['-rnI', args.query, '.', '--exclude-dir=node_modules', '--exclude-dir=.git'], cwd);
      return { status: res.code === 0 ? "success" : "not_found", result: res.stdout || res.stderr };
    } else if (args.type === 'file') {
      // find . -name "*query*" -not -path "*/node_modules/*"
      const res = await runSpawn('find', ['.', '-name', `*${args.query}*`, '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*'], cwd);
      return { status: res.code === 0 ? "success" : "not_found", result: res.stdout || res.stderr };
    }
    
    return { status: "error", message: "Invalid search type." };
  }
};