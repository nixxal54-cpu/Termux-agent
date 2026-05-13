import chalk from 'chalk';

export const UI = {
  system: (msg) => console.log(chalk.cyan(`\n🤖 [SYSTEM] ${msg}`)),
  error: (msg) => console.log(chalk.red(`\n❌ [ERROR] ${msg}`)),
  success: (msg) => console.log(chalk.green(`\n✅ [SUCCESS] ${msg}`)),
  
  agentAction: (thought, action) => {
    console.log(chalk.dim(`\n🤔 ${thought}`));
    if (action && action.tool) {
      console.log(chalk.yellow(`🛠  Running: ${action.tool}`));
      if (action.args && Object.keys(action.args).length > 0) {
        const argsPreview = JSON.stringify(action.args).slice(0, 120);
        console.log(chalk.dim(`    Args: ${argsPreview}${argsPreview.length >= 120 ? '...' : ''}`));
      }
    }
  },

  agentMessage: (msg) => {
    console.log(chalk.blue(`\n${msg}`));
  },

  streamChunk: (chunk) => {
    process.stdout.write(chalk.blue(chunk));
  },

  toolResult: (resultStr) => {
    const preview = resultStr.length > 500 ? resultStr.substring(0, 500) + '... (truncated)' : resultStr;
    console.log(chalk.dim(`\nOutput:\n${preview}`));
  }
};