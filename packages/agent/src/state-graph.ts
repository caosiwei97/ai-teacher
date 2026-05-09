import type { BaseGraphState } from "./types";

export interface GraphNode<S extends BaseGraphState> {
  name: string;
  execute: (state: S, ctx: GraphExecutionContext) => Promise<S>;
}

export interface ConditionalEdge<S extends BaseGraphState> {
  from: string;
  condition: (state: S) => string;
}

export interface StreamEvent {
  type: "node_start" | "node_complete" | "error";
  node: string;
  data?: unknown;
  error?: Error;
}

export interface GraphExecutionContext {
  [key: string]: unknown;
}

export const END = "__end__";

export class StateGraph<S extends BaseGraphState> {
  private nodes = new Map<string, GraphNode<S>>();
  private edges = new Map<string, string | ConditionalEdge<S>>();
  private entryPoint = "";

  setEntryPoint(name: string): this {
    this.entryPoint = name;
    return this;
  }

  addNode(name: string, execute: GraphNode<S>["execute"]): this {
    this.nodes.set(name, { name, execute });
    return this;
  }

  addEdge(from: string, to: string): this {
    this.edges.set(from, to);
    return this;
  }

  addConditionalEdge(from: string, condition: (state: S) => string): this {
    this.edges.set(from, { from, condition });
    return this;
  }

  getNodeNames(): string[] {
    return Array.from(this.nodes.keys());
  }

  async *stream(
    initialState: S,
    ctx: GraphExecutionContext,
  ): AsyncGenerator<StreamEvent> {
    if (!this.entryPoint) {
      throw new Error("StateGraph: no entry point set");
    }

    let current = this.entryPoint;
    let state = initialState;

    while (current !== END) {
      const node = this.nodes.get(current);
      if (!node) {
        throw new Error(`StateGraph: unknown node "${current}"`);
      }

      yield { type: "node_start", node: current };

      try {
        state = await node.execute(state, ctx);
      } catch (error) {
        yield {
          type: "error",
          node: current,
          error: error instanceof Error ? error : new Error(String(error)),
        };
        throw error;
      }

      const completedNode = current;

      // Resolve next node
      const edge = this.edges.get(current);
      if (typeof edge === "string") {
        current = edge;
      } else if (edge && typeof edge === "object" && "condition" in edge) {
        current = edge.condition(state);
      } else {
        current = END;
      }

      yield { type: "node_complete", node: completedNode, data: state };
    }
  }

  /** Execute the graph without streaming events (convenience) */
  async execute(
    initialState: S,
    ctx: GraphExecutionContext,
  ): Promise<S> {
    let finalState = initialState;
    for await (const event of this.stream(initialState, ctx)) {
      if (event.type === "node_complete" && event.data) {
        finalState = event.data as S;
      }
    }
    return finalState;
  }
}
