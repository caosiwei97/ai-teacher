import { z } from "zod";

export const ProviderEnum = z.enum([
  "openai", "anthropic", "deepseek", "qianwen", "kimi",
  "minimax", "xiaomi", "zhipu", "custom",
]);

export const ConfigSource = z.enum(["user", "env"]);

export const CreateLlmConfigSchema = z.object({
  provider: ProviderEnum,
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().min(1),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
  source: ConfigSource.optional(),
});

export type LlmConfigResponse = {
  id: string;
  userId: string;
  provider: string;
  encryptedKey: string; // masked on read
  baseUrl: string | null;
  defaultModel: string;
  label: string | null;
  isDefault: boolean;
  source: "user" | "env";
  createdAt: string;
  updatedAt: string;
};

export interface ModelInfo {
  id: string;
  label: string;
  tier: "flagship" | "standard" | "value" | "light";
  price: string;
}

export interface ProviderPreset {
  name: string;
  baseUrl: string;
  requiresBaseUrl: boolean;
  models: ModelInfo[];
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    requiresBaseUrl: false,
    models: [
      { id: "gpt-5.5", label: "GPT-5.5", tier: "flagship", price: "$11.25/1M" },
      { id: "gpt-5.4", label: "GPT-5.4", tier: "standard", price: "$5.63/1M" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", tier: "value", price: "$1.69/1M" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", tier: "light", price: "$0.46/1M" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "",
    requiresBaseUrl: false,
    models: [
      { id: "claude-opus-4-7", label: "Claude Opus 4.7", tier: "flagship", price: "$10.94/1M" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "standard", price: "$6.56/1M" },
      { id: "claude-4-5-haiku", label: "Claude 4.5 Haiku", tier: "light", price: "$2.19/1M" },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    requiresBaseUrl: false,
    models: [
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", tier: "flagship", price: "$2.17/1M" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", tier: "value", price: "$0.18/1M" },
    ],
  },
  qianwen: {
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    requiresBaseUrl: false,
    models: [
      { id: "qwen3.6-max", label: "Qwen3.6 Max", tier: "flagship", price: "$2.92/1M" },
      { id: "qwen3.6-plus", label: "Qwen3.6 Plus", tier: "standard", price: "$1.13/1M" },
      { id: "qwen3.6-27b", label: "Qwen3.6 27B", tier: "light", price: "$1.35/1M" },
    ],
  },
  kimi: {
    name: "Kimi (Moonshot)",
    baseUrl: "https://api.moonshot.cn/v1",
    requiresBaseUrl: false,
    models: [
      { id: "kimi-k2.6", label: "Kimi K2.6", tier: "flagship", price: "$1.71/1M" },
      { id: "kimi-k2.5", label: "Kimi K2.5", tier: "standard", price: "$1.20/1M" },
    ],
  },
  minimax: {
    name: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
    requiresBaseUrl: false,
    models: [
      { id: "minimax-m2.7", label: "MiniMax-M2.7", tier: "value", price: "$0.52/1M" },
    ],
  },
  xiaomi: {
    name: "小米 (MiMo)",
    baseUrl: "",
    requiresBaseUrl: true,
    models: [
      { id: "mimo-v2.5-pro", label: "MiMo V2.5 Pro", tier: "flagship", price: "$1.50/1M" },
      { id: "mimo-v2.5", label: "MiMo V2.5", tier: "standard", price: "$0.72/1M" },
      { id: "mimo-v2-flash", label: "MiMo V2 Flash", tier: "light", price: "$0.15/1M" },
    ],
  },
  zhipu: {
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    requiresBaseUrl: false,
    models: [
      { id: "glm-5.1", label: "GLM-5.1", tier: "flagship", price: "¥24/1M" },
      { id: "glm-5", label: "GLM-5", tier: "standard", price: "¥18/1M" },
      { id: "glm-4.7", label: "GLM-4.7", tier: "value", price: "¥8/1M" },
      { id: "glm-4.7-flash", label: "GLM-4.7 Flash", tier: "light", price: "免费" },
      { id: "glm-5-turbo", label: "GLM-5 Turbo", tier: "light", price: "¥22/1M" },
    ],
  },
  custom: {
    name: "自定义 OpenAI 兼容",
    baseUrl: "",
    requiresBaseUrl: true,
    models: [],
  },
};
