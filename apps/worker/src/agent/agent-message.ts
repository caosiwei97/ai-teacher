import type { CoreMessage } from "ai";

// ── AgentMessage 分层类型 ──────────────────────────────────

export type AgentMessage =
  | LlmMessage
  | DiagnosticEventMessage
  | MasteryUpdateMessage
  | SystemEventMessage;

export interface LlmMessage {
  type: "llm";
  role: "user" | "assistant";
  content: string;
}

export interface DiagnosticEventMessage {
  type: "diagnostic";
  event: "question" | "answer";
  data: unknown;
}

export interface MasteryUpdateMessage {
  type: "mastery";
  nodeId: string;
  score: number;
  action: "assessed" | "advanced";
}

export interface SystemEventMessage {
  type: "system";
  event: "compact" | "error" | "checkpoint";
  detail: string;
}

// ── 类型守卫 ──────────────────────────────────

export function isLlmMessage(msg: AgentMessage): msg is LlmMessage {
  return msg.type === "llm";
}

export function isDiagnosticEvent(msg: AgentMessage): msg is DiagnosticEventMessage {
  return msg.type === "diagnostic";
}

export function isMasteryUpdate(msg: AgentMessage): msg is MasteryUpdateMessage {
  return msg.type === "mastery";
}

export function isSystemEvent(msg: AgentMessage): msg is SystemEventMessage {
  return msg.type === "system";
}

// ── 转换工具 ──────────────────────────────────

/** CoreMessage[] → AgentMessage[]（全部标记为 llm 类型） */
export function coreMessagesToAgentMessages(messages: CoreMessage[]): AgentMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      type: "llm" as const,
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
    }));
}

/** AgentMessage[] → CoreMessage[]（只保留 llm 类型） */
export function agentMessagesToCoreMessages(messages: AgentMessage[]): CoreMessage[] {
  return messages
    .filter(isLlmMessage)
    .map((m) => ({ role: m.role, content: m.content }));
}
