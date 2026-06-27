import { encrypt } from "./crypto";
import type { PrismaClient } from "@prisma/client";

export interface BackfillResult {
  inserted: number;
  reason?: "no-env-key" | "user-config-exists" | "already-backfilled" | "inserted";
}

// baseUrl 关键词 → provider 推断（与 provider-registry 对齐）
function inferProvider(baseUrl: string): string {
  const u = baseUrl.toLowerCase();
  if (u.includes("deepseek")) return "deepseek";
  if (u.includes("dashscope")) return "qianwen";
  if (u.includes("moonshot") || u.includes("kimi")) return "kimi";
  if (u.includes("minimax")) return "minimax";
  if (u.includes("bigmodel")) return "zhipu";
  if (u.includes("openai.com")) return "openai";
  return "custom";
}

/**
 * 从 .env 回填 LLM 配置到 DB。幂等：
 * - DB 已有任意 user 配置 → 不动（用户优先）
 * - DB 已有 env 配置 → 不重复
 * - 否则插入一条 source=env 的默认配置
 */
export async function backfillLlmConfigsFromEnv(
  prisma: PrismaClient,
  userId: string,
): Promise<BackfillResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { inserted: 0, reason: "no-env-key" };
  }

  const existing = await prisma.llmConfig.findMany({ where: { userId } });

  // 用户已在 UI 配过 → 尊重用户，不回填
  if (existing.some((c) => c.source === "user")) {
    return { inserted: 0, reason: "user-config-exists" };
  }

  // 已有 env 回填记录 → 幂等
  if (existing.some((c) => c.source === "env")) {
    return { inserted: 0, reason: "already-backfilled" };
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? "";
  const provider = inferProvider(baseUrl);

  await prisma.llmConfig.create({
    data: {
      userId,
      provider,
      encryptedKey: encrypt(apiKey),
      baseUrl: baseUrl || null,
      defaultModel: "deepseek-v4-flash",
      label: "环境变量配置",
      isDefault: true,
      source: "env",
    },
  });

  return { inserted: 1, reason: "inserted" };
}
