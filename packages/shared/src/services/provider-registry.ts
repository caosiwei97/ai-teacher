import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createAnthropic } from "@ai-sdk/anthropic";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import type { LanguageModel } from "ai";

export interface ProviderConfig {
  provider: string; // "openai"|"anthropic"|"deepseek"|"qianwen"|"kimi"|"minimax"|"xiaomi"|"zhipu"|"custom"
  apiKey: string;
  baseUrl?: string;
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com",
  qianwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  kimi: "https://api.moonshot.cn/v1",
  minimax: "https://api.minimax.chat/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
};

let _mockProvider: ((modelId: string) => LanguageModel) | null = null;

function getMockProvider(): (modelId: string) => LanguageModel {
  if (!_mockProvider) {
    _mockProvider = (_modelId: string) =>
      new MockLanguageModelV3({
        doGenerate: async () => ({
          content: [{ type: "text", text: "这是一个模拟回复。" }],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          warnings: [],
        }),
        doStream: async ({ prompt }) => {
          // E2E 标记：user 消息含 [render-interactive] → 返回 renderUI(interactive) tool call，
          // 触发 iframe 沙箱渲染链路（mock 默认只返回文本，不调 tool）
          const lastUser = [...(prompt ?? [])]
            .reverse()
            .find((m) => m.role === "user");
          // content 可能是 string 或 parts 数组（如 [{type:'text',text:'...'}]），统一 stringify 检测标记
          const userText = JSON.stringify(lastUser?.content ?? "");

          // 防止 tool-call 循环：若 prompt 已含 tool 结果（上一轮调过 tool），返回默认文本
          const hasToolResult = (prompt ?? []).some(
            (m) => m.role === "tool",
          );
          if (hasToolResult) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "text-start", id: "text-0" },
                  { type: "text-delta", id: "text-0", delta: "这是一个模拟回复。" },
                  { type: "text-end", id: "text-0" },
                  {
                    type: "finish",
                    finishReason: { unified: "stop", raw: undefined },
                    logprobs: undefined,
                    usage: {
                      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                      outputTokens: { total: 20, text: 20, reasoning: undefined },
                    },
                  },
                ],
              }),
            };
          }

          // E2E 标记：[score-answer] → scoreAnswer tool call（面试每题评分，迭代 052③）
          if (userText.includes("[score-answer]")) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  {
                    type: "tool-call",
                    toolCallId: "call-score",
                    toolName: "scoreAnswer",
                    input: JSON.stringify({
                      question: "闭包中变量是引用还是拷贝？",
                      answer: "引用",
                      score: 90,
                      isCorrect: true,
                      difficulty: "medium",
                      feedback: "答对核心",
                    }),
                  },
                  {
                    type: "finish",
                    finishReason: { unified: "stop", raw: undefined },
                    logprobs: undefined,
                    usage: {
                      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                      outputTokens: { total: 20, text: 20, reasoning: undefined },
                    },
                  },
                ],
              }),
            };
          }

          // E2E 标记：[finalize-interview] → finalizeInterview + renderUI(interviewScore)（面试复盘，迭代 052③）
          if (userText.includes("[finalize-interview]")) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  {
                    type: "tool-call",
                    toolCallId: "call-finalize",
                    toolName: "finalizeInterview",
                    input: JSON.stringify({
                      improvement: "建议多练闭包与执行上下文的基础概念，注意变量引用与生命周期。",
                      weakPoints: ["闭包变量生命周期", "执行上下文创建时机"],
                    }),
                  },
                  {
                    type: "tool-call",
                    toolCallId: "call-scorecard",
                    toolName: "renderUI",
                    input: JSON.stringify({
                      blocks: [
                        {
                          type: "interviewScore",
                          totalScore: 75,
                          difficulty: "medium",
                          weakPoints: ["闭包变量生命周期", "执行上下文创建时机"],
                          improvement: "建议多练闭包与执行上下文的基础概念。",
                          questionCount: 1,
                        },
                      ],
                    }),
                  },
                  {
                    type: "finish",
                    finishReason: { unified: "stop", raw: undefined },
                    logprobs: undefined,
                    usage: {
                      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                      outputTokens: { total: 20, text: 20, reasoning: undefined },
                    },
                  },
                ],
              }),
            };
          }

          if (userText.includes("[render-interactive]")) {
            const html =
              '<button id="btn">点我</button><p id="out">未点击</p>' +
              '<script>document.getElementById("btn").addEventListener("click",function(){document.getElementById("out").textContent="已点击"})</script>';
            return {
              stream: simulateReadableStream({
                chunks: [
                  {
                    type: "tool-call",
                    toolCallId: "call-interactive",
                    toolName: "renderUI",
                    input: JSON.stringify({
                      blocks: [{ type: "interactive", html }],
                    }),
                  },
                  {
                    type: "finish",
                    finishReason: { unified: "stop", raw: undefined },
                    logprobs: undefined,
                    usage: {
                      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                      outputTokens: { total: 20, text: 20, reasoning: undefined },
                    },
                  },
                ],
              }),
            };
          }

          // E2E 标记：[render-flashcard] → 返回 renderUI(flashcard) tool call，
          // 触发复习抽认卡渲染链路（迭代 051③）。nodeId 用 seed mastered 节点，便于 E2E 验证 POST /review/result
          if (userText.includes("[render-flashcard]")) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  {
                    type: "tool-call",
                    toolCallId: "call-flashcard",
                    toolName: "renderUI",
                    input: JSON.stringify({
                      blocks: [
                        {
                          type: "flashcard",
                          nodeId: "seed-node-use-state",
                          front: "useState 的初始值支持哪两种形式？分别何时使用？",
                          back: "1. 直接值：`useState(0)` 用于静态初始值。2. 函数：`useState(() => computeHeavy())` 用于惰性初始化，避免每次渲染都重复计算。",
                        },
                      ],
                    }),
                  },
                  {
                    type: "finish",
                    finishReason: { unified: "stop", raw: undefined },
                    logprobs: undefined,
                    usage: {
                      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                      outputTokens: { total: 20, text: 20, reasoning: undefined },
                    },
                  },
                ],
              }),
            };
          }

          return {
            stream: simulateReadableStream({
              chunks: [
                { type: "text-start", id: "text-0" },
                { type: "text-delta", id: "text-0", delta: "这是一个模拟回复。" },
                { type: "text-end", id: "text-0" },
                {
                  type: "finish",
                  finishReason: { unified: "stop", raw: undefined },
                  logprobs: undefined,
                  usage: {
                    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 20, text: 20, reasoning: undefined },
                  },
                },
              ],
            }),
          };
        },
      });
  }
  return _mockProvider;
}

export function createProviderForConfig(
  config: ProviderConfig,
): (modelId: string) => LanguageModel {
  if (process.env.MOCK_LLM === "true") {
    return getMockProvider();
  }

  const { provider, apiKey, baseUrl } = config;

  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return (modelId: string) => anthropic(modelId);
    }
    case "deepseek": {
      const deepseek = createDeepSeek({ apiKey });
      return (modelId: string) => deepseek(modelId);
    }
    default: {
      const baseURL = baseUrl || PROVIDER_BASE_URLS[provider] || undefined;
      const openai = createOpenAI({ apiKey, baseURL });
      return (modelId: string) => openai(modelId);
    }
  }
}

export function getFallbackProvider(): (modelId: string) => LanguageModel {
  if (process.env.MOCK_LLM === "true") {
    return getMockProvider();
  }

  const baseUrl = process.env.OPENAI_BASE_URL || "";
  if (baseUrl.includes("deepseek")) {
    const deepseek = createDeepSeek({ apiKey: process.env.OPENAI_API_KEY! });
    return (modelId: string) => deepseek(modelId);
  }

  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: baseUrl || undefined,
  });
  return (modelId: string) => openai(modelId);
}
