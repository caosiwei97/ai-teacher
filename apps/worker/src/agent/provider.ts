import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

let _provider: ReturnType<typeof createOpenAI> | null = null;

export function getProvider(): (modelId: string) => LanguageModel {
  if (!_provider) {
    _provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL:
        process.env.OPENAI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    });
  }
  return _provider.chat.bind(_provider) as (modelId: string) => LanguageModel;
}
