import { createOpenAI } from "@ai-sdk/openai";

let _provider: ReturnType<typeof createOpenAI> | null = null;

export function getProvider() {
  if (!_provider) {
    _provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL:
        process.env.OPENAI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    });
  }
  return _provider;
}
