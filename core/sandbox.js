import path from 'path';

export class Sandbox {
  constructor(rootDir = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    this.blocklist = [
      '/system', '/root', '/etc', '/dev', '/proc', '/sys', '/var', '/usr', '/bin', '/sbin'
    ];
  }

  isPathAllowed(targetPath) {
    const absPath = path.resolve(this.rootDir, targetPath);
    if (!absPath.startsWith(this.rootDir)) return false;
    
    // Termux specific safety
    return !this.blocklist.some(blocked => absPath.startsWith(blocked));
  }

  resolveSafePath(targetPath) {
    if (!this.isPathAllowed(targetPath)) {
      throw new Error(`Security Violation: Path ${targetPath} is blocked by Sandbox policies.`);
    }
    return path.resolve(this.rootDir, targetPath);
  }

  isCommandSafe(command) {
    const dangerousPatterns = [
      /rm\s+-rf\s+\/$/, /rm\s+-rf\s+\/\*/,
      /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // fork bomb
      />\s*\/dev\/[a-z]+/, // device overwrite
      /chmod\s+-R\s+777\s+\//,
      /mkfs/, /dd\s+if=/
    ];
    return !dangerousPatterns.some(pattern => pattern.test(command));
  }
}
