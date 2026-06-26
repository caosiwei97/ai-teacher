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
        doStream: async () => ({
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
        }),
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
