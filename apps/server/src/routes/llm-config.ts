import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@ai-teacher/db";
import {
  CreateLlmConfigSchema,
  PROVIDER_PRESETS,
} from "@ai-teacher/shared";
import { encrypt, decrypt, maskApiKey } from "@ai-teacher/shared/services/crypto";
import { generateText, APICallError } from "ai";
import { createProviderForConfig } from "@ai-teacher/shared/services/provider-registry";

const listQuerySchema = z.object({
  userId: z.string().min(1),
});

const updateSchema = z.object({
  provider: z.enum([
    "openai", "anthropic", "deepseek", "qianwen", "kimi",
    "minimax", "xiaomi", "zhipu", "custom",
  ]).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  defaultModel: z.string().min(1).optional(),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const providerQuerySchema = z.object({
  provider: z.string().min(1),
});

interface TestErrorDetail {
  statusCode: number | undefined;
  url: string | undefined;
  responseBody: string | undefined;
}

// 把 LLM 调用异常转成可读中文提示 + 结构化详情，供前端展示
function formatTestError(err: unknown): { message: string; detail?: TestErrorDetail } {
  if (APICallError.isInstance(err)) {
    const detail: TestErrorDetail = {
      statusCode: err.statusCode,
      url: err.url,
      responseBody: err.responseBody,
    };
    const status = err.statusCode;
    const body = (err.responseBody ?? "").toLowerCase();

    // 401/403：鉴权问题
    if (status === 401 || status === 403) {
      return { message: "API Key 无效或已过期，请检查密钥", detail };
    }
    // 400 且上游报模型相关错误
    if (status === 400 && (body.includes("model") || body.includes("模型"))) {
      return { message: "模型不存在，请检查模型名是否正确", detail };
    }
    // 404：端点/路由不存在（如供应商不支持 Responses API）
    if (status === 404) {
      return { message: "接口不存在（404），请检查 Base URL 是否正确", detail };
    }
    // 429：限流
    if (status === 429) {
      return { message: "请求过于频繁或额度不足，请稍后再试", detail };
    }
    // 5xx：上游服务异常
    if (status && status >= 500) {
      return { message: `模型服务异常（${status}），请稍后再试`, detail };
    }
    // 其余有状态码的：回退原始 message
    if (status) {
      return { message: err.message, detail };
    }
    // 无状态码：网络/超时类（fetch 失败、连接拒绝等）
    return { message: "无法连接服务，请检查 Base URL 或网络", detail };
  }

  // 非 APICallError：可能是解密失败、provider 构造失败等
  const message = err instanceof Error ? err.message : "未知错误";
  return { message };
}

export const llmConfigRoute = new Hono()
  // GET / — list user's configs (keys masked)
  .get("/", async (c) => {
    const query = c.req.query();
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) {
      return c.json(
        { error: "userId is required", details: z.flattenError(parsed.error) },
        400,
      );
    }

    const { userId } = parsed.data;

    const configs = await prisma.llmConfig.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return c.json({
      configs: configs.map((cfg) => ({
        id: cfg.id,
        userId: cfg.userId,
        provider: cfg.provider,
        apiKey: maskApiKey(decrypt(cfg.encryptedKey)),
        baseUrl: cfg.baseUrl,
        defaultModel: cfg.defaultModel,
        label: cfg.label,
        isDefault: cfg.isDefault,
        source: cfg.source,
        createdAt: cfg.createdAt.toISOString(),
        updatedAt: cfg.updatedAt.toISOString(),
      })),
    });
  })

  // POST / — create config
  .post("/", zValidator("json", CreateLlmConfigSchema), async (c) => {
    const data = c.req.valid("json");
    const userId = c.req.query("userId") ?? "";

    if (!userId) {
      return c.json({ error: "userId query param is required" }, 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // If isDefault, unset other defaults first
    if (data.isDefault) {
      await prisma.llmConfig.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const encryptedKey = encrypt(data.apiKey);

    const config = await prisma.llmConfig.create({
      data: {
        userId,
        provider: data.provider,
        encryptedKey,
        baseUrl: data.baseUrl ?? null,
        defaultModel: data.defaultModel,
        label: data.label ?? null,
        isDefault: data.isDefault ?? false,
      },
    });

    return c.json({
      config: {
        id: config.id,
        userId: config.userId,
        provider: config.provider,
        apiKey: maskApiKey(data.apiKey),
        baseUrl: config.baseUrl,
        defaultModel: config.defaultModel,
        label: config.label,
        isDefault: config.isDefault,
        source: config.source,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      },
    }, 201);
  })

  // PATCH /:id — update config
  .patch("/:id", zValidator("json", updateSchema), async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const userId = c.req.query("userId") ?? "";

    if (!userId) {
      return c.json({ error: "userId query param is required" }, 400);
    }

    const existing = await prisma.llmConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return c.json({ error: "Config not found" }, 404);
    }

    // If setting isDefault, unset other defaults first
    if (data.isDefault) {
      await prisma.llmConfig.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.apiKey !== undefined) updateData.encryptedKey = encrypt(data.apiKey);
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl || null;
    if (data.defaultModel !== undefined) updateData.defaultModel = data.defaultModel;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const config = await prisma.llmConfig.update({
      where: { id },
      data: updateData,
    });

    return c.json({
      config: {
        id: config.id,
        userId: config.userId,
        provider: config.provider,
        apiKey: maskApiKey(decrypt(config.encryptedKey)),
        baseUrl: config.baseUrl,
        defaultModel: config.defaultModel,
        label: config.label,
        isDefault: config.isDefault,
        source: config.source,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  })

  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.req.query("userId") ?? "";

    if (!userId) {
      return c.json({ error: "userId query param is required" }, 400);
    }

    const existing = await prisma.llmConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return c.json({ error: "Config not found" }, 404);
    }

    await prisma.llmConfig.delete({ where: { id } });

    return c.json({ success: true });
  })

  .post("/:id/test", async (c) => {
    const id = c.req.param("id");
    const userId = c.req.query("userId") ?? "";

    if (!userId) {
      return c.json({ error: "userId query param is required" }, 400);
    }

    const config = await prisma.llmConfig.findFirst({
      where: { id, userId },
    });
    if (!config) {
      return c.json({ error: "Config not found" }, 404);
    }

    try {
      const apiKey = decrypt(config.encryptedKey);
      const provider = createProviderForConfig({
        provider: config.provider,
        apiKey,
        baseUrl: config.baseUrl ?? undefined,
      });

      await generateText({
        model: provider(config.defaultModel),
        prompt: "Hi",
        maxOutputTokens: 5,
      });

      return c.json({ success: true });
    } catch (err) {
      const { message, detail } = formatTestError(err);
      return c.json({ success: false, error: message, detail });
    }
  })

  // 动态拉取供应商账号下可用模型（用 apiKey 调供应商 /models 端点）
  .post("/models/live", zValidator("json", z.object({
    provider: z.string().min(1),
    apiKey: z.string().min(1),
    baseUrl: z.string().url().optional().or(z.literal("")),
  })), async (c) => {
    const { provider, apiKey, baseUrl } = c.req.valid("json");

    const preset = PROVIDER_PRESETS[provider];
    const baseURL = (baseUrl || preset?.baseUrl || "").replace(/\/$/, "");
    if (!baseURL) {
      return c.json({ success: false, error: "无法确定 Base URL，请手动填写" });
    }

    const url = `${baseURL}/models`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const responseBody = await res.text().catch(() => "");
        const detail: TestErrorDetail = {
          statusCode: res.status,
          url,
          responseBody: responseBody || undefined,
        };
        const status = res.status;
        let message: string;
        if (status === 401 || status === 403) {
          message = "API Key 无效或已过期，请检查密钥";
        } else if (status === 404) {
          message = "供应商不支持模型列表接口（404），已显示预设模型";
        } else if (status === 429) {
          message = "请求过于频繁，请稍后再试";
        } else if (status >= 500) {
          message = `模型服务异常（${status}），请稍后再试`;
        } else {
          message = `获取模型列表失败（${status}）`;
        }
        return c.json({ success: false, error: message, detail });
      }

      const json = await res.json() as { data?: Array<{ id?: string }> };
      const models = Array.isArray(json.data)
        ? json.data.map((m) => m?.id).filter((id): id is string => typeof id === "string")
        : [];

      return c.json({ success: true, models });
    } catch (err) {
      // 网络/超时类错误（fetch 失败、连接拒绝等）
      const message = err instanceof Error && err.name === "TimeoutError"
        ? "请求超时，请检查 Base URL 或网络"
        : "无法连接服务，请检查 Base URL 或网络";
      return c.json({ success: false, error: message });
    }
  })

  .get("/models", async (c) => {
    const query = c.req.query();
    const parsed = providerQuerySchema.safeParse(query);
    if (!parsed.success) {
      return c.json(
        { error: "provider is required", details: z.flattenError(parsed.error) },
        400,
      );
    }

    const { provider } = parsed.data;
    const preset = PROVIDER_PRESETS[provider];

    if (!preset) {
      return c.json({ error: `Unknown provider: ${provider}` }, 400);
    }

    return c.json({
      provider,
      name: preset.name,
      models: preset.models,
    });
  })

  .get("/env-status", async (c) => {
    const userId = c.req.query("userId") ?? "seed-user-ai-teacher";
    const hasEnvKey = !!process.env.OPENAI_API_KEY;
    const envBaseUrl = process.env.OPENAI_BASE_URL ?? "";

    const dbConfigs = await prisma.llmConfig.findMany({
      where: { userId },
      select: { id: true, isDefault: true, source: true },
    });

    return c.json({
      hasEnvConfig: hasEnvKey,
      baseUrl: envBaseUrl,
      hasDefaultDbConfig: dbConfigs.some((cfg) => cfg.isDefault),
      dbConfigCount: dbConfigs.length,
    });
  });
