import type { z } from "zod";

export interface ToolExecutionContext {
  prisma: unknown;
  sessionId: string;
  userId: string;
}

export interface ToolResult {
  success: boolean;
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute: (
    params: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ) => Promise<ToolResult>;
  promptSnippet?: string;
  promptGuidelines?: string[];
}

export interface AgentResult {
  content: string;
  steps: number;
  toolCalls: Array<{ toolName: string; args: unknown; result: unknown }>;
}

export interface SubagentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
  model?: string;
  toModelOutput: (result: AgentResult) => string;
}
