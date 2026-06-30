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
        doGenerate: async ({ prompt }) => {
          const promptText = JSON.stringify(prompt ?? "");
          const text = promptText.includes("设计学习路线")
            ? JSON.stringify({
                title: "个人投资理财入门",
                nodes: [
                  { index: 0, title: "个人现金流", description: "理解收入、支出和结余的基本关系。" },
                  { index: 1, title: "预算与应急金", description: "建立预算框架和基础安全垫。" },
                  { index: 2, title: "风险收益关系", description: "理解收益、波动、期限和流动性的取舍。" },
                  { index: 3, title: "常见投资品类", description: "认识存款、债券、基金和股票的差异。" },
                  { index: 4, title: "资产配置入门", description: "把目标、风险承受力和投资组合连接起来。" },
                ],
              })
            : "这是一个模拟回复。";
          return {
            content: [{ type: "text", text }],
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
            warnings: [],
          };
        },
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
              '<div id="quiz"><button id="btn">点我</button><p id="out">未点击</p></div>' +
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

          if (userText.includes("[Interactive Response]")) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "text-start", id: "text-0" },
                  {
                    type: "text-delta",
                    id: "text-0",
                    delta: "收到你的互动结果，我们继续往下看下一步判断。",
                  },
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

          if (userText.includes("请教我学习《个人投资理财入门》")) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "text-start", id: "text-0" },
                  {
                    type: "text-delta",
                    id: "text-0",
                    delta:
                      "你好！个人投资理财是个非常实用的技能，让我先了解一下你的基础情况。",
                  },
                  { type: "text-end", id: "text-0" },
                  {
                    type: "tool-call",
                    toolCallId: "call-diagnostic",
                    toolName: "askQuestion",
                    input: JSON.stringify({
                      nodeId: "diagnosis",
                      question: "先来做几道题看看你的基础",
                      questions: [
                        {
                          id: "d1",
                          title: "基础认知",
                          question: "你目前对个人投资理财的了解程度更接近哪一项？",
                          options: [
                            { id: "a", text: "基本不了解，希望从零开始" },
                            { id: "b", text: "知道一些概念，但不成体系" },
                            { id: "c", text: "有过基金或股票投资经验" },
                          ],
                        },
                        {
                          id: "d2",
                          title: "风险理解",
                          question: "你如何看待投资收益和风险的关系？",
                          options: [
                            { id: "a", text: "收益越高越好，风险暂时不清楚" },
                            { id: "b", text: "大概知道高收益通常伴随高风险" },
                            { id: "c", text: "能结合期限、波动和流动性一起判断" },
                          ],
                        },
                        {
                          id: "d3",
                          title: "实践经验",
                          question: "你现在是否有记账、预算或资产配置习惯？",
                          options: [
                            { id: "a", text: "还没有系统习惯" },
                            { id: "b", text: "偶尔记录或做预算" },
                            { id: "c", text: "已经有固定预算和配置计划" },
                          ],
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

          if (userText.includes("[Quiz Response]")) {
            return {
              stream: simulateReadableStream({
                chunks: [
                  {
                    type: "tool-call",
                    toolCallId: "call-roadmap",
                    toolName: "generateRoadmap",
                    input: JSON.stringify({
                      topic: "个人投资理财入门",
                      learnerLevel: "beginner",
                      diagnosticSummary: "学习者需要从预算、风险和资产配置基础开始。",
                      startHint: "先建立收支和风险收益的基础框架",
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

          if (userText.includes("[Continue] 开始教学知识点")) {
            const html =
              '<div id="quiz"><h3>现金流小测</h3><p>先存钱再消费，会优先锁定结余。</p><button id="optA">先消费再存钱</button><button id="optB">先存钱再消费</button><p id="feedback"></p></div>' +
              '<script>document.getElementById("optA").addEventListener("click",function(){document.getElementById("feedback").textContent="再想想，结余容易被消费挤掉。"});document.getElementById("optB").addEventListener("click",function(){document.getElementById("feedback").textContent="正确，先锁定结余更稳定。"})</script>';
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "text-start", id: "text-0" },
                  {
                    type: "text-delta",
                    id: "text-0",
                    delta:
                      "路线已经准备好。我们先从个人现金流开始，先做一个小互动。",
                  },
                  { type: "text-end", id: "text-0" },
                  {
                    type: "tool-call",
                    toolCallId: "call-first-lesson-interactive",
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
                chunkDelayInMs: 350,
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
      // 走 OpenAI Chat Completions（/chat/completions），不用默认的 Responses API（/responses）。
      // 国产 OpenAI 兼容供应商（智谱/通义/Kimi/MiniMax/小米/自定义）普遍只实现了 chat 端点。
      return (modelId: string) => openai.chat(modelId);
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
