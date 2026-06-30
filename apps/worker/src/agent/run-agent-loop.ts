import {
  streamText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type Tool,
} from "ai";
import { createSSEEvent, SSEEventType } from "@ai-teacher/shared";
import { StreamingBlockParser } from "../streaming/block-parser";

export interface AgentLoopOptions {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  tools: Record<string, Tool>;
  publisher: { publish: (channel: string, message: string) => Promise<number> };
  channel: string;
  maxSteps?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export interface AgentLoopResult {
  assistantText: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
  steps: number;
  stopReason: "no-tool-call" | "max-steps" | "timeout" | "aborted";
}

export async function runAgentLoop(
  opts: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const {
    model,
    system,
    messages,
    tools,
    publisher,
    channel,
    maxSteps = 7,
    timeoutMs = 120_000,
  } = opts;

  let currentMessages: ModelMessage[] = [...messages];
  let assistantText = "";
  const allToolResults: Array<{ toolName: string; result: unknown }> = [];
  let step = 0;
  let stopReason: AgentLoopResult["stopReason"] = "no-tool-call";

  const deadline = Date.now() + timeoutMs;

  for (step = 0; step < maxSteps; step++) {
    if (opts.abortSignal?.aborted) {
      stopReason = "aborted";
      break;
    }
    if (Date.now() > deadline) {
      stopReason = "timeout";
      break;
    }

    const result = streamText({
      model,
      system,
      messages: currentMessages,
      tools,
      stopWhen: stepCountIs(1),
      abortSignal: opts.abortSignal,
    });

    let stepText = "";
    let stepHasToolCall = false;
    const stepToolResults: Array<{ toolName: string; result: unknown }> = [];
    let blockParser: StreamingBlockParser | null = null;
    let streamingToolName: string | null = null;

    for await (const event of result.fullStream) {
      if (opts.abortSignal?.aborted) {
        stopReason = "aborted";
        break;
      }
      if (Date.now() > deadline) {
        stopReason = "timeout";
        break;
      }

      const eventType = event.type as string;

      if (eventType === "text-delta" && "text" in event) {
        const text = (event as { text: string }).text;
        stepText += text;
        await publisher.publish(
          channel,
          createSSEEvent(SSEEventType.TextDelta, { content: text }),
        );
      } else if (eventType === "tool-input-start" && "toolName" in event) {
        const toolName = (event as { toolName: string }).toolName;
        if (toolName === "renderUI") {
          streamingToolName = toolName;
          blockParser = new StreamingBlockParser({
            onBlock: async (block, index) => {
              await publisher.publish(
                channel,
                createSSEEvent(SSEEventType.UiBlockDelta, {
                  data: { block, index },
                }),
              );
            },
          });
          await publisher.publish(
            channel,
            createSSEEvent(SSEEventType.UiStreamStart, { data: {} }),
          );
        }
      } else if (
        eventType === "tool-input-delta" &&
        "inputTextDelta" in event
      ) {
        if (streamingToolName === "renderUI" && blockParser) {
          blockParser.feed(
            (event as { inputTextDelta: string }).inputTextDelta,
          );
        }
      } else if (
        eventType === "tool-input-available" ||
        eventType === "tool-input-end"
      ) {
        if (blockParser) {
          blockParser.flush();
          blockParser = null;
          streamingToolName = null;
        }
      } else if (eventType === "tool-call" && "toolName" in event) {
        stepHasToolCall = true;
        await publisher.publish(
          channel,
          createSSEEvent(SSEEventType.ToolCall, {
            data: {
              toolName: (event as { toolName: string }).toolName,
              input: (event as { input: unknown }).input,
            },
          }),
        );
      } else if (eventType === "tool-result" && "toolName" in event) {
        const toolEvent = event as unknown as {
          toolName: string;
          output: unknown;
        };
        stepToolResults.push({
          toolName: toolEvent.toolName,
          result: toolEvent.output,
        });
        await publisher.publish(
          channel,
          createSSEEvent(SSEEventType.ToolResult, {
            data: { toolName: toolEvent.toolName, result: toolEvent.output },
          }),
        );
        await publishToolSideEffects(publisher, channel, toolEvent);
      } else if (eventType === "error" && "error" in event) {
        throw (event as { error: unknown }).error;
      }
    }

    assistantText += stepText;
    allToolResults.push(...stepToolResults);

    if (opts.abortSignal?.aborted) {
      stopReason = "aborted";
      break;
    }

    if (!stepHasToolCall) {
      stopReason = "no-tool-call";
      break;
    }

    if (
      stepToolResults.some(
        (r) => r.toolName === "askQuestion" || r.toolName === "generateRoadmap",
      )
    ) {
      break;
    }

    if (step === maxSteps - 1) {
      stopReason = "max-steps";
      break;
    }

    // AI SDK with maxSteps:1 handles tool execution and returns the result
    // in the stream. The response messages include the assistant + tool results,
    // so we append them for the next iteration.
    const response = await result.response;
    // Safety: ensure all values in tool results are JSON-serializable
    // (e.g. Prisma Date objects → ISO strings) to prevent schema validation
    // failures on subsequent streamText calls.
    const sanitized = JSON.parse(
      JSON.stringify(response.messages),
    ) as ModelMessage[];
    currentMessages = [...currentMessages, ...sanitized];
  }

  return {
    assistantText,
    toolResults: allToolResults,
    steps: step + 1,
    stopReason,
  };
}

async function publishToolSideEffects(
  publisher: { publish: (channel: string, message: string) => Promise<number> },
  channel: string,
  toolEvent: { toolName: string; output: unknown },
) {
  const output = toolEvent.output as Record<string, unknown>;

  if (toolEvent.toolName === "renderUI") {
    if (output.uiBlocks && Array.isArray(output.uiBlocks)) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.UiBlocks, {
          data: { uiBlocks: output.uiBlocks },
        }),
      );
    }
  } else if (toolEvent.toolName === "pushCode") {
    if (output.code) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.CodePush, {
          data: {
            code: output.code,
            language: output.language,
            instruction: output.instruction,
          },
        }),
      );
    }
  } else if (toolEvent.toolName === "askQuestion") {
    if (output.questions && Array.isArray(output.questions)) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.AskQuestion, {
          data: {
            questions: output.questions,
            question: output.question,
            nodeId: output.nodeId,
          },
        }),
      );
    }
  } else if (toolEvent.toolName === "assessMastery") {
    if (output.roadmapUpdate) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.RoadmapUpdated, {
          data: { nodes: (output.roadmapUpdate as { nodes: unknown[] }).nodes },
        }),
      );
    }
    if (output.sessionUpdate) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.SessionUpdated, {
          data: output.sessionUpdate,
        }),
      );
    }
  } else if (toolEvent.toolName === "generateRoadmap") {
    if (output.roadmapUpdate) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.RoadmapUpdated, {
          data: { nodes: (output.roadmapUpdate as { nodes: unknown[] }).nodes },
        }),
      );
    }
    if (output.sessionUpdate) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.SessionUpdated, {
          data: output.sessionUpdate,
        }),
      );
    }
  }
}
