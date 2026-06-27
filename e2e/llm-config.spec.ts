import { test, expect } from "@playwright/test";

const USER_ID = "seed-user-ai-teacher";

test.describe("LLM Config API — CRUD", () => {
  let createdConfigId: string;

  test("should list empty configs for seed user", async ({ request }) => {
    const response = await request.get(`/api/llm?userId=${USER_ID}`);
    expect(response.ok()).toBeTruthy();

    const { configs } = await response.json();
    expect(Array.isArray(configs)).toBe(true);
  });

  test("should create a new LLM config", async ({ request }) => {
    const response = await request.post(`/api/llm?userId=${USER_ID}`, {
      data: {
        provider: "deepseek",
        apiKey: "sk-test-e2e-fake-key-12345",
        defaultModel: "deepseek-v4-flash",
        label: "E2E Test Config",
        isDefault: true,
      },
    });
    expect(response.status()).toBe(201);

    const { config } = await response.json();
    expect(config.provider).toBe("deepseek");
    expect(config.defaultModel).toBe("deepseek-v4-flash");
    expect(config.label).toBe("E2E Test Config");
    expect(config.isDefault).toBe(true);
    expect(config.apiKey).not.toContain("sk-test-e2e-fake-key-12345");
    expect(config.apiKey).toContain("***");

    createdConfigId = config.id;
  });

  test("should list the created config", async ({ request }) => {
    const createRes = await request.post(`/api/llm?userId=${USER_ID}`, {
      data: {
        provider: "openai",
        apiKey: "sk-test-list-check",
        defaultModel: "gpt-5.4-mini",
      },
    });
    const { config: created } = await createRes.json();

    const listRes = await request.get(`/api/llm?userId=${USER_ID}`);
    expect(listRes.ok()).toBeTruthy();

    const { configs } = await listRes.json();
    const found = configs.find((c: { id: string }) => c.id === created.id);
    expect(found).toBeDefined();
    expect(found.provider).toBe("openai");

    await request.delete(`/api/llm/${created.id}?userId=${USER_ID}`);
  });

  test("should update a config", async ({ request }) => {
    const createRes = await request.post(`/api/llm?userId=${USER_ID}`, {
      data: {
        provider: "deepseek",
        apiKey: "sk-test-update-key",
        defaultModel: "deepseek-v4-flash",
      },
    });
    const { config: created } = await createRes.json();

    const patchRes = await request.patch(`/api/llm/${created.id}?userId=${USER_ID}`, {
      data: {
        defaultModel: "deepseek-v4-pro",
        label: "Updated Label",
      },
    });
    expect(patchRes.ok()).toBeTruthy();

    const { config: updated } = await patchRes.json();
    expect(updated.defaultModel).toBe("deepseek-v4-pro");
    expect(updated.label).toBe("Updated Label");

    await request.delete(`/api/llm/${created.id}?userId=${USER_ID}`);
  });

  test("should delete a config", async ({ request }) => {
    const createRes = await request.post(`/api/llm?userId=${USER_ID}`, {
      data: {
        provider: "zhipu",
        apiKey: "sk-test-delete-key",
        defaultModel: "glm-5-turbo",
      },
    });
    const { config: created } = await createRes.json();

    const deleteRes = await request.delete(`/api/llm/${created.id}?userId=${USER_ID}`);
    expect(deleteRes.ok()).toBeTruthy();

    const listRes = await request.get(`/api/llm?userId=${USER_ID}`);
    const { configs } = await listRes.json();
    const found = configs.find((c: { id: string }) => c.id === created.id);
    expect(found).toBeUndefined();
  });

  test("should return 400 without userId", async ({ request }) => {
    const response = await request.get("/api/llm");
    expect(response.status()).toBe(400);
  });

  test("should return preset models for a provider", async ({ request }) => {
    const response = await request.get(`/api/llm/models?provider=deepseek`);
    expect(response.ok()).toBeTruthy();

    const { models } = await response.json();
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models[0]).toHaveProperty("id");
    expect(models[0]).toHaveProperty("label");
    expect(models[0]).toHaveProperty("tier");
  });
});

test.describe("LLM Config — backfill & source", () => {
  test("GET / 返回的配置含 source 字段（user/env）", async ({ request }) => {
    const response = await request.get(`/api/llm?userId=${USER_ID}`);
    expect(response.ok()).toBeTruthy();

    const { configs } = await response.json();
    for (const cfg of configs) {
      expect(["user", "env"]).toContain(cfg.source);
    }
  });

  test("GET /env-status 返回回填状态扩展字段", async ({ request }) => {
    const response = await request.get(`/api/llm/env-status`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty("hasEnvConfig");
    expect(body).toHaveProperty("hasDefaultDbConfig");
    expect(body).toHaveProperty("dbConfigCount");
    expect(typeof body.dbConfigCount).toBe("number");
  });

  test("POST 创建的配置 source 默认 user", async ({ request }) => {
    const response = await request.post(`/api/llm?userId=${USER_ID}`, {
      data: {
        provider: "deepseek",
        apiKey: "sk-e2e-source-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
      },
    });
    expect(response.status()).toBe(201);

    const { config } = await response.json();
    expect(config.source).toBe("user");

    await request.delete(`/api/llm/${config.id}?userId=${USER_ID}`);
  });
});
