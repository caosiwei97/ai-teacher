import {
  streamText,
  generateText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type Tool,
} from "ai";
import { createSSEEvent, SSEEventType } from "@ai-teacher/shared";
import { StreamingBlockParser } from "../streaming/block-parser";
import { LoopDetector } from "./loop-detector";

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
  fallbackModel?: LanguageModel;
  fallbackProviderModel?: { model: LanguageModel };
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
  const loopDetector = new LoopDetector();

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

    const stepT0 = Date.now();
    await publisher.publish(
      channel,
      createSSEEvent(SSEEventType.StepStart, { step, total: maxSteps, t0: stepT0 }),
    );

    let stepText = "";
    let stepHasToolCall = false;
    const stepToolResults: Array<{ toolName: string; result: unknown }> = [];
    let nextMessages: ModelMessage[] | null = null;
    let circuitBroken = false;

    const result = streamText({
      model,
      system,
      messages: currentMessages,
      tools,
      stopWhen: stepCountIs(1),
      abortSignal: opts.abortSignal,
    });

    try {
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

        if (eventType === "reasoning-delta" && "text" in event) {
          const delta = (event as { text: string }).text;
          await publisher.publish(
            channel,
            createSSEEvent(SSEEventType.ReasoningDelta, { step, text: delta }),
          );
        } else if (eventType === "text-delta" && "text" in event) {
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
          const tcEvent = event as { toolName: string; input: unknown };
          const detection = loopDetector.check({
            toolName: tcEvent.toolName,
            args: (tcEvent.input as Record<string, unknown>) ?? {},
          });
          if (detection) {
            if (loopDetector.shouldCircuitBreak()) {
              await publisher.publish(
                channel,
                createSSEEvent(SSEEventType.Error, {
                  data: { message: `检测到循环调用（${detection.toolName}），已停止。请换个方式提问。` },
                }),
              );
              stopReason = "aborted";
              circuitBroken = true;
              break;
            }
            loopDetector.recordCorrection();
            await publisher.publish(
              channel,
              createSSEEvent(SSEEventType.LoopWarning, {
                type: detection.type,
                toolName: detection.toolName,
                step,
              }),
            );
            currentMessages.push({
              role: "system",
              content: `你连续重复调用了 ${detection.toolName}，请换思路或直接用已有信息回答。`,
            });
          }
          await publisher.publish(
            channel,
            createSSEEvent(SSEEventType.ToolCall, {
              data: {
                toolName: tcEvent.toolName,
                input: tcEvent.input,
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

      const response = await result.response;
      const sanitized = JSON.parse(
        JSON.stringify(response.messages),
      ) as ModelMessage[];
      nextMessages = sanitized;
    } catch (err) {
      const failover = await degradeStep({
        err,
        step,
        system,
        messages: currentMessages,
        tools,
        publisher,
        channel,
        mainModel: model,
        fallbackModel: opts.fallbackModel,
        fallbackProviderModel: opts.fallbackProviderModel,
        abortSignal: opts.abortSignal,
      });
      stepText = failover.text;
      stepHasToolCall = failover.hasToolCall;
      stepToolResults.push(...failover.toolResults);
      nextMessages = failover.responseMessages;
    }

    assistantText += stepText;
    allToolResults.push(...stepToolResults);

    await publisher.publish(
      channel,
      createSSEEvent(SSEEventType.StepEnd, { step, durationMs: Date.now() - stepT0 }),
    );

    if (circuitBroken) {
      break;
    }

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

    if (nextMessages) {
      const sanitized = JSON.parse(
        JSON.stringify(nextMessages),
      ) as ModelMessage[];
      currentMessages = [...currentMessages, ...sanitized];
    }
  }

  return {
    assistantText,
    toolResults: allToolResults,
    steps: step + 1,
    stopReason,
  };
}

interface DegradedStep {
  text: string;
  hasToolCall: boolean;
  toolResults: Array<{ toolName: string; result: unknown }>;
  responseMessages: ModelMessage[] | null;
}

async function degradeStep(opts: {
  err: unknown;
  step: number;
  system: string;
  messages: ModelMessage[];
  tools: Record<string, Tool>;
  publisher: { publish: (channel: string, message: string) => Promise<number> };
  channel: string;
  mainModel: LanguageModel;
  fallbackModel?: LanguageModel;
  fallbackProviderModel?: { model: LanguageModel };
  abortSignal?: AbortSignal;
}): Promise<DegradedStep> {
  const { err } = opts;
  const reason = err instanceof Error ? err.message : String(err);
  const { publisher, channel, step } = opts;

  // ① 非流式 generateText（主 model）
  try {
    await publisher.publish(
      channel,
      createSSEEvent(SSEEventType.Failover, {
        from: "stream",
        to: "non-stream",
        reason,
        step,
      }),
    );
    const gen = await generateText({
      model: opts.mainModel,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      stopWhen: stepCountIs(1),
      abortSignal: opts.abortSignal,
    });
    if (gen.text) {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.TextDelta, { content: gen.text }),
      );
    }
    const toolResults = gen.toolResults.map((tr) => ({
      toolName: tr.toolName,
      result: tr.output,
    }));
    for (const tr of gen.toolResults) {
      const toolEvent = { toolName: tr.toolName, output: tr.output };
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.ToolCall, {
          data: { toolName: tr.toolName, input: tr.input },
        }),
      );
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.ToolResult, {
          data: { toolName: tr.toolName, result: tr.output },
        }),
      );
      await publishToolSideEffects(publisher, channel, toolEvent);
    }
    return {
      text: gen.text,
      hasToolCall: gen.toolCalls.length > 0,
      toolResults,
      responseMessages: JSON.parse(
        JSON.stringify(gen.response.messages),
      ) as ModelMessage[],
    };
  } catch {
    // 非流式也失败，继续降级到 fallback model
  }

  // ② fallback model（非流式 generateText）
  const fallbackModel =
    opts.fallbackModel ?? opts.fallbackProviderModel?.model;
  if (fallbackModel) {
    try {
      await publisher.publish(
        channel,
        createSSEEvent(SSEEventType.Failover, {
          from: "non-stream",
          to: "fallback-model",
          reason,
          step,
        }),
      );
      const gen = await generateText({
        model: fallbackModel,
        system: opts.system,
        messages: opts.messages,
        tools: opts.tools,
        stopWhen: stepCountIs(1),
        abortSignal: opts.abortSignal,
      });
      if (gen.text) {
        await publisher.publish(
          channel,
          createSSEEvent(SSEEventType.TextDelta, { content: gen.text }),
        );
      }
      const toolResults = gen.toolResults.map((tr) => ({
        toolName: tr.toolName,
        result: tr.output,
      }));
      for (const tr of gen.toolResults) {
        const toolEvent = { toolName: tr.toolName, output: tr.output };
        await publisher.publish(
          channel,
          createSSEEvent(SSEEventType.ToolCall, {
            data: { toolName: tr.toolName, input: tr.input },
          }),
        );
        await publisher.publish(
          channel,
          createSSEEvent(SSEEventType.ToolResult, {
            data: { toolName: tr.toolName, result: tr.output },
          }),
        );
        await publishToolSideEffects(publisher, channel, toolEvent);
      }
      return {
        text: gen.text,
        hasToolCall: gen.toolCalls.length > 0,
        toolResults,
        responseMessages: JSON.parse(
          JSON.stringify(gen.response.messages),
        ) as ModelMessage[],
      };
    } catch {
      // fallback 也失败，继续抛出原始错误
    }
  }

  // 所有降级均失败，抛出原始错误
  throw err;
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
