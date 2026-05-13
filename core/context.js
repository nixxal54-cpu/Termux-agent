import fs from 'fs-extra';
import path from 'path';

export class ContextManager {
  constructor() {
    this.sysPromptPath = path.join(process.cwd(), 'prompts', 'system.txt');
    this.toolsPromptPath = path.join(process.cwd(), 'prompts', 'tool_rules.txt');
    this.plannerPromptPath = path.join(process.cwd(), 'prompts', 'planner.txt');
  }

  async loadPrompts() {
    try {
      const sys = await fs.readFile(this.sysPromptPath, 'utf8');
      const tools = await fs.readFile(this.toolsPromptPath, 'utf8');
      const planner = await fs.readFile(this.plannerPromptPath, 'utf8');
      this.prompts = { sys, tools, planner };
    } catch (e) {
      console.error("Failed to load prompts:", e.message);
      this.prompts = { sys: "You are an AI.", tools: "", planner: "" };
    }
  }

  getSystemContext() {
    return `${this.prompts.sys}\n\n${this.prompts.tools}`;
  }
  
  getPlannerContext() {
    return this.prompts.planner;
  }
}
