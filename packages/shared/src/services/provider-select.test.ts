import { describe, it, expect } from "vitest";
import { resolveProviderConfig } from "./provider-select";

function mockPrisma(config: any | null) {
  return {
    llmConfig: {
      findFirst: async () => config,
    },
  } as any;
}

describe("resolveProviderConfig", () => {
  it("显式 llmConfigId → 直接查该配置", async () => {
    const prisma = mockPrisma({
      id: "explicit", provider: "zhipu", encryptedKey: "enc", baseUrl: null, defaultModel: "glm-5",
      isDefault: true,
    });
    const result = await resolveProviderConfig(prisma, {
      userId: "u1",
      llmConfigId: "explicit",
    });
    expect(result.source).toBe("explicit");
    expect(result.config?.id).toBe("explicit");
  });

  it("无 llmConfigId → 查用户 default 配置", async () => {
    const prisma = mockPrisma({
      id: "def", provider: "deepseek", encryptedKey: "enc", baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-v4-flash",
      isDefault: true,
    });
    const result = await resolveProviderConfig(prisma, { userId: "u1" });
    expect(result.source).toBe("default-db");
    expect(result.config?.id).toBe("def");
  });

  it("无 llmConfigId 且 DB 无 default → source=env-fallback", async () => {
    const prisma = mockPrisma(null);
    const result = await resolveProviderConfig(prisma, { userId: "u1" });
    expect(result.source).toBe("env-fallback");
    expect(result.config).toBeNull();
  });
});
