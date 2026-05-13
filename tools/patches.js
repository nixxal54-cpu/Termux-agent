import fs from 'fs-extra';
import path from 'path';

export const patchesTool = {
  name: "patch_tool",
  description: "Apply minimal edits or substring replacements to a file without rewriting the whole file.",
  schema: {
    filePath: "string",
    searchString: "string",
    replaceString: "string"
  },
  execute: async (args) => {
    if (!args.filePath || args.searchString === undefined || args.replaceString === undefined) {
      return { status: "error", message: "Missing required arguments for patching." };
    }
    const absPath = path.resolve(process.cwd(), args.filePath);
    try {
      let content = await fs.readFile(absPath, 'utf8');
      if (!content.includes(args.searchString)) {
         return { status: "error", message: "Search string not found in file." };
      }
      content = content.replace(args.searchString, args.replaceString);
      await fs.writeFile(absPath, content);
      return { status: "success", message: "File patched successfully." };
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }
};
