import { createOpenAI } from "@ai-sdk/openai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import type { LanguageModel } from "ai";

let _provider: ReturnType<typeof createOpenAI> | null = null;
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

export function getProvider(): (modelId: string) => LanguageModel {
  if (process.env.MOCK_LLM === "true") {
    return getMockProvider();
  }

  if (!_provider) {
    _provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL:
        process.env.OPENAI_BASE_URL ?? "https://open.bigmodel.cn/api/coding/paas/v4",
    });
  }
  return _provider.chat.bind(_provider) as (modelId: string) => LanguageModel;
}
