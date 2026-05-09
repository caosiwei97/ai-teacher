import type { CoreMessage } from "ai";

/** State for a StateGraph execution */
export interface BaseGraphState {
  sessionId: string;
  messages: CoreMessage[];
  [key: string]: unknown;
}

/** Tutor-specific state extending BaseGraphState */
export interface TutorState extends BaseGraphState {
  topic: string;
  currentNodeId: string;
  allNodes: Array<{ id: string; index: number; title: string; status: string }>;
  masteredNodes: string[];
  learnerProfile: string;
  currentNode: { id: string; title: string; description: string };
  summary?: unknown;
  streamResult?: unknown;
  newMessages?: CoreMessage[];
  needsFollowUp?: boolean;
  assistantText?: string;
  toolResults?: Array<{ toolName: string; result: unknown }>;
}

/** Configuration for graph execution */
export interface GraphConfig {
  maxSteps: number;
  tokenBudget: number;
  streamTimeoutMs: number;
}

/** Context injected into every tool execution */
export interface ToolExecutionContext {
  prisma: unknown;
  sessionId: string;
  userId: string;
}

/** Result from a tool execution */
export interface ToolResult {
  success: boolean;
  [key: string]: unknown;
}

/** Tool hooks for before/after interception */
export interface ToolHooks {
  beforeToolCall?: (
    name: string,
    params: unknown,
    ctx: ToolExecutionContext,
  ) => Promise<{ skip: boolean; result?: ToolResult }>;
  afterToolCall?: (
    name: string,
    params: unknown,
    result: ToolResult,
    ctx: ToolExecutionContext,
  ) => Promise<void>;
}

/** Checkpoint store interface */
export interface CheckpointStore {
  save(sessionId: string, graphNode: string, state: unknown): Promise<string>;
  load(checkpointId: string): Promise<{ graphNode: string; state: unknown } | null>;
  loadLatest(sessionId: string): Promise<{ graphNode: string; state: unknown } | null>;
}

/** Metadata about a checkpoint */
export interface CheckpointMetadata {
  id: string;
  sessionId: string;
  graphNode: string;
  createdAt: Date;
}
