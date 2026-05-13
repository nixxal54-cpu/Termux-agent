import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Verifier } from '../../core/verifier.js';

export const patchTool = {
  name: "patch_file",
  description: "Apply a targeted patch to a file using search and replace. Avoids full file rewrites.",
  schema: {
    filePath: "string (relative path)",
    search: "string (the exact exact text to replace including whitespace)",
    replace: "string (the replacement text)"
  },
  execute: async (args, context) => {
    let tmpPath = null;
    try {
      const absPath = context.workspace.resolveSafePath(args.filePath);
      if (!(await fs.pathExists(absPath))) {
        return { status: "error", message: "File does not exist." };
      }

      const content = await fs.readFile(absPath, 'utf8');
      if (!content.includes(args.search)) {
        return { status: "error", message: "Search string not found in file. Make sure whitespace matches exactly." };
      }
       
      const occurrences = content.split(args.search).length - 1;
      if (occurrences > 1) {
         return { status: "error", message: `Search string found ${occurrences} times. Provide more context to ensure a unique match.` };
      }

      const updated = content.replace(args.search, args.replace);

      // Write to temp file first, verify syntax there — never corrupt the real file
      tmpPath = path.join(os.tmpdir(), `agent_patch_${Date.now()}${path.extname(absPath)}`);
      await fs.writeFile(tmpPath, updated, 'utf8');

      const verification = await Verifier.verifySyntax(tmpPath, context.workspace.rootDir);
      if (!verification.valid) {
        await fs.remove(tmpPath);
        return { status: "error", message: `Verification failed: ${verification.message}` };
      }

      // Safe to atomically replace the real file now
      await fs.move(tmpPath, absPath, { overwrite: true });
      tmpPath = null;

      return { status: "success", message: "File patched and verified successfully." };
    } catch (e) {
      if (tmpPath) await fs.remove(tmpPath).catch(() => {});
      return { status: "error", message: e.message };
    }
  }
};