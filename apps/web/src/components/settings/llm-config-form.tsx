
import { useState } from "react";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createLlmConfig } from "@/lib/api-client";
import { getProviderList, getProviderDisplay } from "@/lib/llm-presets";
import { ProviderCard } from "./provider-card";
import { ModelSelector } from "./model-selector";

const USER_ID = "seed-user-ai-teacher";

interface LlmConfigFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { label: "选择服务商", icon: 1 },
  { label: "配置密钥", icon: 2 },
  { label: "选择模型", icon: 3 },
];

export function LlmConfigForm({ onCancel, onSuccess }: LlmConfigFormProps) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [label, setLabel] = useState("");
  const [fallbackModelId, setFallbackModelId] = useState("");
  const [fallbackLlmConfigId, setFallbackLlmConfigId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providers = getProviderList();
  const selectedDisplay = getProviderDisplay(provider);

  function handleProviderSelect(key: string) {
    const display = getProviderDisplay(key);
    setProvider(key);
    setBaseUrl(display?.baseUrl ?? "");
    setDefaultModel("");
    setStep(1);
  }

  async function handleSubmit() {
    if (!provider || !apiKey || !defaultModel) return;
    setSubmitting(true);
    setError(null);
    try {
      await createLlmConfig(USER_ID, {
        provider,
        apiKey,
        baseUrl: selectedDisplay?.requiresBaseUrl ? baseUrl : undefined,
        defaultModel,
        label: label || undefined,
        isDefault: false,
        fallbackModelId: fallbackModelId || undefined,
        fallbackLlmConfigId: fallbackLlmConfigId || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建配置失败");
    } finally {
      setSubmitting(false);
    }
  }

  function canProceed() {
    switch (step) {
      case 0: return !!provider;
      case 1: return !!apiKey && (!selectedDisplay?.requiresBaseUrl || !!baseUrl);
      case 2: return !!defaultModel;
      default: return false;
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">添加新配置</h2>
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          取消
        </button>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : s.icon}
            </div>
            <span className={cn("text-xs", i <= step ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[240px]">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">选择你的 AI 服务商</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {providers.map((p) => (
                <ProviderCard
                  key={p.key}
                  name={p.name}
                  color={p.color}
                  selected={provider === p.key}
                  onClick={() => handleProviderSelect(p.key)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
              />
            </div>

            {selectedDisplay?.requiresBaseUrl && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">备注名称（可选）</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="如：工作账号"
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <ModelSelector
              provider={provider}
              apiKey={apiKey}
              baseUrl={selectedDisplay?.requiresBaseUrl ? baseUrl : undefined}
              value={defaultModel}
              onChange={setDefaultModel}
            />

            <div className="space-y-2 border-t border-border pt-4">
              <label className="text-xs font-medium text-muted-foreground">备用模型 ID（可选，主模型失败时降级）</label>
              <input
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
                value={fallbackModelId}
                onChange={(e) => setFallbackModelId(e.target.value)}
                placeholder="如 deepseek-v4-flash"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">备用配置 ID（可选，跨配置降级时使用）</label>
              <input
                className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
                value={fallbackLlmConfigId}
                onChange={(e) => setFallbackLlmConfigId(e.target.value)}
                placeholder="如留空则仅同配置内降级"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {step === 0 ? "取消" : "上一步"}
        </button>

        {step < 2 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              canProceed()
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            下一步
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || submitting}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              canProceed() && !submitting
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                保存中…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                保存配置
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
