import { z } from "zod";

export const SSEEventType = {
  TextDelta: "text-delta",
  ToolCall: "tool-call",
  ToolResult: "tool-result",
  UiStreamStart: "ui-stream-start",
  UiBlockDelta: "ui-block-delta",
  UiBlocks: "ui-blocks",
  CodePush: "code-push",
  AskQuestion: "ask-question",
  RoadmapUpdated: "roadmap-updated",
  SessionUpdated: "session-updated",
  TitleUpdated: "title-updated",
  Error: "error",
  Done: "done",
  StepStart: "step-start",
  StepEnd: "step-end",
  ReasoningDelta: "reasoning-delta",
  Failover: "failover",
  LoopWarning: "loop-warning",
  Usage: "usage",
  ContextInfo: "context-info",
  Abort: "abort",
} as const;

export type SSEEventType = (typeof SSEEventType)[keyof typeof SSEEventType];

export const SSEEventSchema = z.object({
  type: z.string(),
  content: z.unknown().optional(),
  data: z.unknown().optional(),
  message: z.string().optional(),
});

export type SSEEvent = z.infer<typeof SSEEventSchema>;

export interface PromptContextBreakdown {
  system: number;
  user: number;
  assistant: number;
  tools: number;
  mcpTools: number;
}

export function createSSEEvent(
  type: SSEEventType,
  payload?: Record<string, unknown>,
): string {
  return JSON.stringify({ type, ...payload });
}

export function parseSSEEvent(raw: unknown): SSEEvent | null {
  const result = SSEEventSchema.safeParse(raw);
  return result.success ? result.data : null;
}
