import { streamText, stepCountIs, type LanguageModel } from "ai";
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
  /** Provider function from job-level LLM config. Falls back to env-var provider. */
  providerFn?: (modelId: string) => LanguageModel;
  /** Default model name from job-level LLM config. Falls back to "deepseek-v4-flash". */
  defaultModel?: string;
  sandboxModel?: string;
  sandboxBaseUrl?: string;
}

function createTutorGraph() {
  return new StateGraph<TutorState>()
    .setEntryPoint("prepare_context")
    .addNode("prepare_context", async (state, ctx) => {
      const graphCtx = ctx as TutorGraphContext;
      await graphCtx.checkpoint.save(state.sessionId, "prepare_context", state);

      const result = await graphCtx.contextManager.prepareForStream(
        state.sessionId,
        state.messages,
      );

      return {
        ...state,
        messages: result.messages,
        summary: result.summary ?? state.summary,
        needsCompaction: result.needsCompaction,
      };
    })
    .addNode("agent_loop", async (state, ctx) => {
      const graphCtx = ctx as TutorGraphContext;
      await graphCtx.checkpoint.save(state.sessionId, "agent_loop", state);

      const isDiagnosisPhase = state.allNodes.every(
        (n) => n.status === "not-started",
      );

      const systemPrompt = buildTutorSystemPrompt({
        topic: state.topic,
        currentNode: state.currentNode,
        allNodes: state.allNodes,
        masteredNodes: state.masteredNodes.join(", ") || "无",
        learnerProfile: state.learnerProfile || "首次学习",
        teachingMode: state.teachingMode,
        isDiagnosisPhase,
        sandboxModel: graphCtx.sandboxModel,
        sandboxBaseUrl: graphCtx.sandboxBaseUrl,
      });

      const toolPromptSection = graphCtx.toolRegistry.toPromptSection();
      const fullSystemPrompt = toolPromptSection
        ? `${systemPrompt}\n\n# 工具使用说明\n\n${toolPromptSection}`
        : systemPrompt;

      const toolCtx = {
        prisma: graphCtx.prisma,
        sessionId: state.sessionId,
        userId: graphCtx.userId,
      };
      const tools = graphCtx.toolRegistry.toAiSdkTools(toolCtx);

      const modelName = graphCtx.defaultModel ?? "deepseek-v4-flash";
      const providerFn = graphCtx.providerFn ?? getProvider();
      const model = providerFn(modelName);
      const result = streamText({
        model,
        system: fullSystemPrompt,
        messages: state.messages,
        tools,
        stopWhen: stepCountIs(7)
      });

      let assistantText = "";
      const toolResults: Array<{ toolName: string; result: unknown }> = [];

      for await (const event of result.fullStream) {
        const eventType = event.type as string;
        if (eventType === "text-delta" && "text" in event) {
          assistantText += (event as { text: string }).text;
          await graphCtx.publisher.publish(
            graphCtx.channel,
            JSON.stringify({ type: "text-delta", content: (event as { text: string }).text }),
          );
        } else if (eventType === "tool-call" && "toolName" in event) {
          await graphCtx.publisher.publish(
            graphCtx.channel,
            JSON.stringify({
              type: "tool-call",
              data: { toolName: (event as { toolName: string; input: unknown }).toolName, input: (event as { input: unknown }).input },
            }),
          );
        } else if (eventType === "tool-result" && "toolName" in event) {
          const toolEvent = event as unknown as { toolName: string; output: unknown };
          toolResults.push({ toolName: toolEvent.toolName, result: toolEvent.output });
          await graphCtx.publisher.publish(
            graphCtx.channel,
            JSON.stringify({
              type: "tool-result",
              data: { toolName: toolEvent.toolName, result: toolEvent.output },
            }),
          );
          if (toolEvent.toolName === "renderUI") {
            const output = toolEvent.output as { success: boolean; uiBlocks?: unknown[] };
            if (output.uiBlocks && Array.isArray(output.uiBlocks)) {
              await graphCtx.publisher.publish(
                graphCtx.channel,
                JSON.stringify({ type: "ui-blocks", data: { uiBlocks: output.uiBlocks } }),
              );
            }
          }
          if (toolEvent.toolName === "pushCode") {
            const output = toolEvent.output as { success: boolean; code?: string; language?: string; instruction?: string };
            if (output.code) {
              await graphCtx.publisher.publish(
                graphCtx.channel,
                JSON.stringify({ type: "code-push", data: { code: output.code, language: output.language, instruction: output.instruction } }),
              );
            }
          }
          if (toolEvent.toolName === "askQuestion") {
            const output = toolEvent.output as { success: boolean; questions?: unknown[]; question?: string; nodeId?: string };
            if (output.questions && Array.isArray(output.questions)) {
              await graphCtx.publisher.publish(
                graphCtx.channel,
                JSON.stringify({ type: "ask-question", data: { questions: output.questions, question: output.question, nodeId: output.nodeId } }),
              );
            }
          }
          if (toolEvent.toolName === "assessMastery") {
            const output = toolEvent.output as {
              success: boolean;
              roadmapUpdate?: { nodes: unknown[] };
              sessionUpdate?: { masteredNodes?: number; totalNodes?: number; title?: string; learningStatus?: string };
            };
            if (output.roadmapUpdate) {
              await graphCtx.publisher.publish(
                graphCtx.channel,
                JSON.stringify({ type: "roadmap-updated", data: { nodes: output.roadmapUpdate.nodes } }),
              );
            }
            if (output.sessionUpdate) {
              await graphCtx.publisher.publish(
                graphCtx.channel,
                JSON.stringify({ type: "session-updated", data: output.sessionUpdate }),
              );
            }
          }
          if (toolEvent.toolName === "generateRoadmap") {
            const output = toolEvent.output as {
              success: boolean;
              roadmapUpdate?: { nodes: unknown[] };
              sessionUpdate?: { masteredNodes?: number; totalNodes?: number };
              firstNode?: { id: string; title: string; description: string };
            };
            if (output.roadmapUpdate) {
              await graphCtx.publisher.publish(
                graphCtx.channel,
                JSON.stringify({ type: "roadmap-updated", data: { nodes: output.roadmapUpdate.nodes } }),
              );
            }
            if (output.sessionUpdate) {
              await graphCtx.publisher.publish(
                graphCtx.channel,
                JSON.stringify({ type: "session-updated", data: output.sessionUpdate }),
              );
            }
          }
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

      if (state.needsCompaction) {
        graphCtx.contextManager.compactAfterStream(
          state.sessionId,
          state.messages,
        ).catch((err) => {
          console.error("[post_process] async compaction failed:", err);
        });
      }

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
