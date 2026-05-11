import { PROVIDER_PRESETS } from "@ai-teacher/shared";
import type { ModelInfo } from "./api-client";

export type ProviderColor =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "red"
  | "yellow"
  | "brown"
  | "teal"
  | "gray";

export interface ProviderDisplay {
  key: string;
  name: string;
  color: ProviderColor;
  baseUrl: string;
  requiresBaseUrl: boolean;
  models: ModelInfo[];
}

const COLOR_MAP: Record<string, ProviderColor> = {
  openai: "blue",
  anthropic: "purple",
  deepseek: "green",
  qianwen: "orange",
  kimi: "red",
  minimax: "yellow",
  xiaomi: "brown",
  zhipu: "teal",
  custom: "gray",
};

const COLOR_CLASSES: Record<ProviderColor, { bg: string; text: string; border: string; dot: string }> = {
  blue:   { bg: "bg-blue-500/10",  text: "text-blue-400",  border: "border-blue-500/40",  dot: "bg-blue-500" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/40", dot: "bg-purple-500" },
  green:  { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/40", dot: "bg-emerald-500" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/40", dot: "bg-orange-500" },
  red:    { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/40",    dot: "bg-red-500" },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/40", dot: "bg-yellow-500" },
  brown:  { bg: "bg-amber-700/10",  text: "text-amber-600",  border: "border-amber-700/40",  dot: "bg-amber-700" },
  teal:   { bg: "bg-teal-500/10",   text: "text-teal-400",   border: "border-teal-500/40",   dot: "bg-teal-500" },
  gray:   { bg: "bg-gray-500/10",   text: "text-gray-400",   border: "border-gray-500/40",   dot: "bg-gray-500" },
};

export const TIER_CONFIG: Record<string, { label: string; className: string }> = {
  flagship: { label: "旗舰", className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  standard: { label: "日常", className: "bg-stone-500/15 text-stone-300 border border-stone-500/30" },
  value:    { label: "性价比", className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  light:    { label: "轻量", className: "bg-gray-500/15 text-gray-400 border border-gray-500/30" },
};

export function getProviderList(): ProviderDisplay[] {
  return Object.entries(PROVIDER_PRESETS).map(([key, preset]) => ({
    key,
    name: preset.name,
    color: COLOR_MAP[key] ?? "gray",
    baseUrl: preset.baseUrl,
    requiresBaseUrl: preset.requiresBaseUrl,
    models: preset.models,
  }));
}

export function getColorClasses(color: ProviderColor) {
  return COLOR_CLASSES[color];
}

export function getProviderDisplay(providerKey: string): ProviderDisplay | undefined {
  const preset = PROVIDER_PRESETS[providerKey];
  if (!preset) return undefined;
  return {
    key: providerKey,
    name: preset.name,
    color: COLOR_MAP[providerKey] ?? "gray",
    baseUrl: preset.baseUrl,
    requiresBaseUrl: preset.requiresBaseUrl,
    models: preset.models,
  };
}
