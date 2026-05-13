import { spawn } from 'child_process';

export class Verifier {
  static async verifySyntax(filePath, cwd) {
    if (filePath.endsWith('.js')) {
      return new Promise((resolve) => {
        const child = spawn('node', ['--check', filePath], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', async (code) => {
          if (code !== 0) {
            resolve({ valid: false, message: `Syntax Error:\n${stderr.trim()}` });
          } else {
            resolve({ valid: true, message: 'Syntax verified successfully.' });
          }
        });
      });
    }
    return { valid: true, message: 'No verifier available for this file type, assumed valid.' };
  }
}