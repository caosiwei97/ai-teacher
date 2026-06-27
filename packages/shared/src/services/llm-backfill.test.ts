import { describe, it, expect, beforeEach } from "vitest";
import { backfillLlmConfigsFromEnv } from "./llm-backfill";

// encrypt 内部读 LLM_ENCRYPTION_KEY，测试环境兜底一个合法的 64 字符 hex
process.env.LLM_ENCRYPTION_KEY = "0".repeat(64);

// 最小 prisma mock：记录 create 调用，findMany 返回可控
function makeMockPrisma(existing: any[]) {
  const created: any[] = [];
  const updated: any[] = [];
  return {
    created,
    updated,
    prisma: {
      llmConfig: {
        findMany: async () => existing,
        create: async ({ data }: any) => { created.push(data); return { id: `c${created.length}`, ...data }; },
        updateMany: async ({ data }: any) => { updated.push(data); return { count: 0 }; },
      },
    } as any,
  };
}

describe("backfillLlmConfigsFromEnv", () => {
  beforeEach(() => {
    // 清理 env，每个 case 显式设置
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  it("env 有 KEY 且 DB 无配置 → 插入 source=env 的配置并设为 default", async () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    process.env.OPENAI_BASE_URL = "https://api.deepseek.com";
    const { prisma, created } = makeMockPrisma([]);

    const result = await backfillLlmConfigsFromEnv(prisma, "seed-user-ai-teacher");

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      userId: "seed-user-ai-teacher",
      source: "env",
      isDefault: true,
    });
    // provider 推断：baseUrl 含 deepseek → provider "deepseek"
    expect(created[0].provider).toBe("deepseek");
    expect(result.inserted).toBe(1);
  });

  it("DB 已有 user 配置 → 不回填，不覆盖用户配置", async () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    const { prisma, created } = makeMockPrisma([
      { id: "existing", userId: "seed-user-ai-teacher", provider: "zhipu", source: "user", isDefault: true },
    ]);

    const result = await backfillLlmConfigsFromEnv(prisma, "seed-user-ai-teacher");

    expect(created).toHaveLength(0);
    expect(result.inserted).toBe(0);
  });

  it("DB 已有 env 回填配置 → 幂等，不重复插入", async () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    const { prisma, created } = makeMockPrisma([
      { id: "env1", userId: "seed-user-ai-teacher", provider: "deepseek", source: "env", isDefault: true },
    ]);

    const result = await backfillLlmConfigsFromEnv(prisma, "seed-user-ai-teacher");

    expect(created).toHaveLength(0);
    expect(result.inserted).toBe(0);
  });

  it("env 无 KEY → 不回填，返回 inserted=0", async () => {
    const { prisma, created } = makeMockPrisma([]);

    const result = await backfillLlmConfigsFromEnv(prisma, "seed-user-ai-teacher");

    expect(created).toHaveLength(0);
    expect(result.inserted).toBe(0);
    expect(result.reason).toBe("no-env-key");
  });

  it("baseUrl 不含已知 provider → provider 为 custom", async () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    process.env.OPENAI_BASE_URL = "https://my-internal-llm.corp/v1";
    const { prisma, created } = makeMockPrisma([]);

    await backfillLlmConfigsFromEnv(prisma, "seed-user-ai-teacher");

    expect(created[0].provider).toBe("custom");
  });
});
