import readlineSync from 'readline-sync';
import chalk from 'chalk';

export class PermissionManager {
  constructor(config = {}) {
    this.allowDangerous = config.allowDangerousCommands || false;
  }

  askPermission(actionDescription) {
    const answer = readlineSync.question(chalk.magenta(`\n⚠️  The agent wants to: ${actionDescription}\nAllow? (y/N): `));
    return answer.toLowerCase() === 'y';
  }

  check(command) {
    if (this.allowDangerous) return true;
    return this.askPermission(`Run dangerous command: ${command}`);
  }
}
