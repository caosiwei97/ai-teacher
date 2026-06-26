import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";

// 迭代 009：Embedding 服务（智谱 GLM embedding-3，走 OpenAI 兼容端点，复用 @ai-sdk/openai）。
// DeepSeek 无 embedding API，故独立于此处的 chat provider。

let cachedProvider: ReturnType<typeof createOpenAI> | null = null;

export function getEmbeddingDimensions(): number {
  return Number(process.env.EMBEDDING_DIMENSIONS) || 1024;
}

function getProvider(): ReturnType<typeof createOpenAI> {
  if (cachedProvider) return cachedProvider;
  const apiKey = process.env.EMBEDDING_API_KEY;
  const baseURL = process.env.EMBEDDING_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
  if (!apiKey) {
    throw new Error(
      "EMBEDDING_API_KEY not set. Provide 智谱 GLM embedding-3 API key (see .env.example).",
    );
  }
  cachedProvider = createOpenAI({ apiKey, baseURL });
  return cachedProvider;
}

/** 批量文本向量化；空输入短路返回空数组 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  // MOCK_LLM=true 时返回确定性合成向量，保持 E2E 与离线测试 hermetic（不调外部 embedding API）
  if (process.env.MOCK_LLM === "true") {
    return texts.map((t) => mockEmbed(t, getEmbeddingDimensions()));
  }
  const model = getProvider().embedding(process.env.EMBEDDING_MODEL || "embedding-3");
  // @ai-sdk/openai v3 的 embedding() 不收 settings 参数，dimensions 经 providerOptions 透传
  const { embeddings } = await embedMany({
    model,
    values: texts,
    providerOptions: { openai: { dimensions: getEmbeddingDimensions() } },
  });
  return embeddings;
}

/** 确定性合成向量（文本哈希 seeded + L2 归一化），仅用于 MOCK_LLM 测试隔离 */
function mockEmbed(text: string, dimensions: number): number[] {
  const vec = new Array(dimensions).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dimensions] += text.charCodeAt(i);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
