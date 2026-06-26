import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@ai-teacher/db";
import {
  CreateLlmConfigSchema,
  PROVIDER_PRESETS,
} from "@ai-teacher/shared";
import { encrypt, decrypt, maskApiKey } from "@ai-teacher/shared/services/crypto";
import { generateText } from "ai";
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
      const message = err instanceof Error ? err.message : "Unknown error";
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

  .get("/env-status", (c) => {
    const hasKey = !!process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL ?? "";
    return c.json({ hasEnvConfig: hasKey, baseUrl });
  });
