import fs from 'fs-extra';
import path from 'path';

export const filesTool = {
  name: "files",
  description: "Read, write, edit, and list files. Prefer 'patch' tool for modifying existing files instead of full writes.",
  schema: {
    action: "'read' | 'write' | 'list'",
    filePath: "string (relative)",
    content: "string (optional, for writes)"
  },
  execute: async (args, context) => {
    try {
      const absPath = context.workspace.resolveSafePath(args.filePath);
      
      switch (args.action) {
        case 'read':
          if (!(await fs.pathExists(absPath))) return { status: "error", message: "File not found" };
          const data = await fs.readFile(absPath, 'utf8');
          return { status: "success", content: data };
          
        case 'write':
          await fs.ensureDir(path.dirname(absPath));
          await fs.writeFile(absPath, args.content || '');
          return { status: "success", message: "File written" };
          
        case 'list':
          if (!(await fs.pathExists(absPath))) return { status: "error", message: "Directory not found" };
          const items = await fs.readdir(absPath);
          return { status: "success", items };
          
        default:
          return { status: "error", message: "Invalid action" };
      }
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }
};
