import { runCLI } from './cli/cli_index.js';

// Start the CLI application
runCLI().catch(err => {
    console.error("Fatal initialization error:", err);
    process.exit(1);
});