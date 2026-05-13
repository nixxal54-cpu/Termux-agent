import path from 'path';

export class WorkspaceManager {
  constructor(rootDir = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
  }

  isPathAllowed(targetPath) {
    const absPath = path.resolve(this.rootDir, targetPath);
    // Path must start with the root directory to be safe
    return absPath.startsWith(this.rootDir);
  }

  resolveSafePath(targetPath) {
    if (!this.isPathAllowed(targetPath)) {
      throw new Error(`Security Violation: Path ${targetPath} is outside the allowed workspace.`);
    }
    return path.resolve(this.rootDir, targetPath);
  }
}
