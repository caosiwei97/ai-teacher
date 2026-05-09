import { tool as aiTool } from "ai";
import type { Tool } from "ai";
import { z } from 'zod';
import type {
  ToolExecutionContext,
  ToolResult,
  ToolHooks,
} from "./types";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute: (params: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<ToolResult>;
  /** Injected into system prompt to describe how to use this tool */
  promptSnippet?: string;
  /** Usage guidelines injected alongside the tool description */
  promptGuidelines?: string[];
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private hooks: ToolHooks = {};

  register(toolDef: ToolDefinition): this {
    this.tools.set(toolDef.name, toolDef);
    return this;
  }

  registerAll(toolDefs: ToolDefinition[]): this {
    for (const def of toolDefs) {
      this.register(def);
    }
    return this;
  }

  setHooks(hooks: ToolHooks): this {
    this.hooks = hooks;
    return this;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    const toolDef = this.tools.get(name);
    if (!toolDef) {
      throw new Error(`ToolRegistry: tool "${name}" not found`);
    }

    // beforeToolCall hook
    if (this.hooks.beforeToolCall) {
      const decision = await this.hooks.beforeToolCall(name, params, ctx);
      if (decision.skip && decision.result) {
        return decision.result;
      }
    }

    const result = await toolDef.execute(params, ctx);

    // afterToolCall hook
    if (this.hooks.afterToolCall) {
      await this.hooks.afterToolCall(name, params, result, ctx);
    }

    return result;
  }

  /** Collect all tools' promptSnippets for system prompt injection */
  toPromptSection(): string {
    const sections: string[] = [];
    for (const def of this.tools.values()) {
      if (def.promptSnippet) {
        sections.push(def.promptSnippet);
      }
      if (def.promptGuidelines && def.promptGuidelines.length > 0) {
        sections.push(
          def.promptGuidelines.map((g) => `- ${g}`).join("\n"),
        );
      }
    }
    return sections.join("\n\n");
  }

  /** Convert to AI SDK tools format for use with streamText/generateText */
  toAiSdkTools(ctx: ToolExecutionContext): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, def] of this.tools) {
      result[name] = aiTool({
        description: def.description,
        inputSchema: def.inputSchema,
        execute: async (params) => {
          return this.execute(name, params as Record<string, unknown>, ctx);
        },
      });
    }
    return result;
  }
}
