import { UI } from '../utils/formatter.js';
import { bus, EVENTS } from './event_bus.js';
import { TokenBudgetEngine } from './token_budget.js';

export class Executor {
  constructor(toolsList, sandbox) {
    this.tools = new Map();
    toolsList.forEach(t => this.tools.set(t.name, t));
    this.workspace = sandbox; // Kept as 'workspace' for backward compatibility with tools
  }

  getToolSchemas() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      schema: t.schema
    }));
  }

  async execute(action) {
    if (!action || !action.tool) {
      return { status: "error", message: "Invalid action format, missing 'tool'." };
    }

    const tool = this.tools.get(action.tool);
    if (!tool) {
      return { status: "error", message: `Tool not found: ${action.tool}` };
    }

    bus.emit(EVENTS.TOOL_EXECUTE, { tool: action.tool, args: action.args });

    try {
      const toolContext = { workspace: this.workspace, budgetEngine: TokenBudgetEngine };
      const result = await tool.execute(action.args, toolContext);
      bus.emit(EVENTS.TOOL_RESULT, { tool: action.tool, result });
      return result;
    } catch (error) {
      const errorMsg = error.message || error.toString();
      bus.emit(EVENTS.SYSTEM_ERROR, { context: `Executor.execute[${action.tool}]`, error: errorMsg });
      return { status: "error", message: errorMsg };
    }
  }
}
