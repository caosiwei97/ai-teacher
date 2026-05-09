/** Agent telemetry events for observability */
export type AgentEventType =
  | "graph_start"
  | "graph_end"
  | "node_start"
  | "node_end"
  | "tool_call"
  | "tool_result"
  | "tool_error"
  | "checkpoint_saved"
  | "error"
  | "context_compact";

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  sessionId: string;
  data?: Record<string, unknown>;
}

export type AgentEventHandler = (event: AgentEvent) => void;

export class AgentEventEmitter {
  private handlers: AgentEventHandler[] = [];

  on(handler: AgentEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: AgentEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[AgentEventEmitter] handler error:", err);
      }
    }
  }

  /** Convenience: emit with auto-timestamp */
  send(
    type: AgentEventType,
    sessionId: string,
    data?: Record<string, unknown>,
  ): void {
    this.emit({ type, timestamp: Date.now(), sessionId, data });
  }
}
