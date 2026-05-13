import shell from 'shelljs';
import { isDangerousCommand, validateToolArgs } from '../utils/validator.js';

export const shellTool = {
  name: "shell_exec",
  description: "Execute a shell command. Keeps state between commands if necessary.",
  schema: {
    command: "string (The command to execute)"
  },
  execute: async (args) => {
    validateToolArgs(args, ['command']);
    
    if (isDangerousCommand(args.command)) {
      return { status: "error", message: "Command blocked for safety reasons." };
    }

    try {
      const result = shell.exec(args.command, { silent: true });
      return {
        status: result.code === 0 ? "success" : "error",
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code
      };
    } catch (error) {
      return { status: "error", message: error.message };
    }
  }
};
