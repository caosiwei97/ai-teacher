import { streamText } from "ai";
import {
  StateGraph,
  END,
  type TutorState,
  type GraphExecutionContext,
  type ToolRegistry,
  type CheckpointStore,
  type SubagentRegistry,
} from "@ai-teacher/agent";
import { buildTutorSystemPrompt } from "../agent/prompts/tutor";
import { ContextManager } from "../agent/context-manager";
import { getProvider } from "../agent/provider";

export interface TutorGraphContext extends GraphExecutionContext {
  toolRegistry: ToolRegistry;
  checkpoint: CheckpointStore;
  prisma: unknown;
  sessionId: string;
  userId: string;
  publisher: { publish: (channel: string, message: string) => Promise<number> };
  channel: string;
  contextManager: ContextManager;
  subagentRegistry?: SubagentRegistry;
}

function createTutorGraph() {
  return new StateGraph<TutorState>()
    .setEntryPoint("prepare_context")
    .addNode("prepare_context", async (state, ctx) => {
      const graphCtx = ctx as TutorGraphContext;
      await graphCtx.checkpoint.save(state.sessionId, "prepare_context", state);

      const result = await graphCtx.contextManager.process(
        state.sessionId,
        state.messages,
      );

      return {
        ...state,
        messages: result.messages,
        summary: result.summary ?? state.summary,
      };
    })
    .addNode("agent_loop", async (state, ctx) => {
      const graphCtx = ctx as TutorGraphContext;
      await graphCtx.checkpoint.save(state.sessionId, "agent_loop", state);

      const systemPrompt = buildTutorSystemPrompt({
        topic: state.topic,
        currentNode: state.currentNode,
        allNodes: state.allNodes,
        masteredNodes: state.masteredNodes.join(", ") || "无",
        learnerProfile: state.learnerProfile || "首次学习",
      });

      const toolCtx = {
        prisma: graphCtx.prisma,
        sessionId: state.sessionId,
        userId: graphCtx.userId,
      };
      const tools = graphCtx.toolRegistry.toAiSdkTools(toolCtx);

      const model = getProvider()("glm-5-turbo");
      const result = await streamText({
        model,
        system: systemPrompt,
        messages: state.messages,
        tools,
        maxSteps: 3,
      });

      let assistantText = "";
      const toolResults: Array<{ toolName: string; result: unknown }> = [];

      for await (const event of result.fullStream) {
        const eventType = event.type as string;
        if (eventType === "text-delta" && "textDelta" in event) {
          assistantText += (event as { textDelta: string }).textDelta;
          await graphCtx.publisher.publish(
            graphCtx.channel,
            JSON.stringify({ type: "text-delta", content: (event as { textDelta: string }).textDelta }),
          );
        } else if (eventType === "tool-call" && "toolName" in event) {
          await graphCtx.publisher.publish(
            graphCtx.channel,
            JSON.stringify({
              type: "tool-call",
              data: { toolName: (event as { toolName: string; args: unknown }).toolName, args: (event as { args: unknown }).args },
            }),
          );
        } else if (eventType === "tool-result" && "toolName" in event) {
          const toolEvent = event as unknown as { toolName: string; result: unknown };
          toolResults.push({ toolName: toolEvent.toolName, result: toolEvent.result });
          await graphCtx.publisher.publish(
            graphCtx.channel,
            JSON.stringify({
              type: "tool-result",
              data: { toolName: toolEvent.toolName, result: toolEvent.result },
            }),
          );
        } else if (eventType === "error" && "error" in event) {
          throw (event as { error: unknown }).error;
        }
      }

      return {
        ...state,
        assistantText,
        toolResults,
        needsFollowUp: false,
      };
    })
    .addNode("post_process", async (state, ctx) => {
      const graphCtx = ctx as TutorGraphContext;
      await graphCtx.checkpoint.save(state.sessionId, "post_process", state);
      return state;
    })
    .addEdge("prepare_context", "agent_loop")
    .addConditionalEdge("agent_loop", (state) =>
      state.needsFollowUp ? "prepare_context" : "post_process",
    )
    .addEdge("post_process", END);
}

let _tutorGraph: ReturnType<typeof createTutorGraph> | null = null;

export function getTutorGraph() {
  if (!_tutorGraph) {
    _tutorGraph = createTutorGraph();
  }
  return _tutorGraph;
}
