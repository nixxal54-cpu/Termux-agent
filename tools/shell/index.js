import { spawn } from 'child_process';
import { isDangerousCommand } from '../../utils/validator.js';

export const shellTool = {
  name: "execute_shell",
  description: "Execute a shell command. Supports long running processes with timeouts.",
  schema: {
    command: "string (the command to run)",
    timeout: "number (optional, timeout in ms, default 30000)"
  },
  execute: (args, context) => {
    return new Promise((resolve) => {
      const command = args.command;
      if (isDangerousCommand(command)) {
        return resolve({ status: "error", message: "Command blocked for safety reasons." });
      }

      const cwd = context.workspace.rootDir;
      const timeoutMs = args.timeout || 30000;

      // Use spawn for streaming capability and better process control
      const child = spawn(command, {
        shell: true,
        cwd: cwd,
        stdio: ['ignore', 'pipe', 'pipe'], // Critical: never inherit stdin — it steals readline's input pipe
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // Optional: emit chunks to bus for live streaming logs
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const killTimer = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          status: "timeout",
          stdout,
          stderr,
          message: `Process killed after ${timeoutMs}ms timeout.`
        });
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(killTimer);
        const engine = new context.budgetEngine();
        
        const finalStdout = engine.truncateOutput(stdout, 2000);
        const finalStderr = engine.truncateOutput(stderr, 2000);

        if (code === 0) {
          resolve({ status: "success", stdout: finalStdout, exitCode: code });
        } else {
          resolve({ status: "error", stdout: finalStdout, stderr: finalStderr, exitCode: code });
        }
      });
      
      child.on('error', (err) => {
        clearTimeout(killTimer);
        resolve({ status: "error", message: err.message });
      });
    });
  }
};