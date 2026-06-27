import type { PrismaClient } from "@prisma/client";

export interface RawLlmConfig {
  id: string;
  provider: string;
  encryptedKey: string;
  baseUrl: string | null;
  defaultModel: string;
  isDefault: boolean;
}

export interface ResolveInput {
  userId: string;
  llmConfigId?: string;
}

export type ResolveResult =
  | { source: "explicit"; config: RawLlmConfig }
  | { source: "default-db"; config: RawLlmConfig }
  | { source: "env-fallback"; config: null };

/**
 * 选择 LLM 配置的优先级：
 * 1. 显式 llmConfigId → 查该条
 * 2. 否则查用户 isDefault 配置
 * 3. 都没有 → env-fallback（调用方用 getFallbackProvider）
 */
export async function resolveProviderConfig(
  prisma: PrismaClient,
  input: ResolveInput,
): Promise<ResolveResult> {
  if (input.llmConfigId) {
    const config = await prisma.llmConfig.findFirst({
      where: { id: input.llmConfigId, userId: input.userId },
      select: { id: true, provider: true, encryptedKey: true, baseUrl: true, defaultModel: true, isDefault: true },
    });
    if (!config) throw new Error(`LlmConfig ${input.llmConfigId} not found`);
    return { source: "explicit", config };
  }

  const def = await prisma.llmConfig.findFirst({
    where: { userId: input.userId, isDefault: true },
    select: { id: true, provider: true, encryptedKey: true, baseUrl: true, defaultModel: true, isDefault: true },
  });
  if (def) return { source: "default-db", config: def };

  return { source: "env-fallback", config: null };
}
