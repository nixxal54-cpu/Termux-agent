import fs from 'fs-extra';
import path from 'path';

export const filesTool = {
  name: "files_tool",
  description: "Read, write, append, edit, and list files and directories. Provides robust file operations.",
  schema: {
    action: "read|write|append|list",
    filePath: "string",
    content: "string (optional for read/list)"
  },
  execute: async (args) => {
    if (!args.action || !args.filePath) {
      throw new Error("Missing action or filePath");
    }

    const { action, filePath, content } = args;
    const absPath = path.resolve(process.cwd(), filePath);

    try {
      if (action === 'read') {
        const data = await fs.readFile(absPath, 'utf-8');
        return { status: 'success', content: data };
      } else if (action === 'write') {
        await fs.ensureDir(path.dirname(absPath));
        await fs.writeFile(absPath, content || '');
        return { status: 'success', message: 'File written successfully' };
      } else if (action === 'append') {
        await fs.ensureDir(path.dirname(absPath));
        await fs.appendFile(absPath, content || '');
        return { status: 'success', message: 'Content appended' };
      } else if (action === 'list') {
        const items = await fs.readdir(absPath);
        return { status: 'success', items };
      }
      return { status: 'error', message: 'Invalid action' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
};
