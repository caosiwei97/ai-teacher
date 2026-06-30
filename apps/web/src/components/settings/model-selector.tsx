
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderModels, fetchLiveModels, type ModelInfo } from "@/lib/api-client";
import { PROVIDER_PRESETS } from "@ai-teacher/shared";
import { TIER_CONFIG } from "@/lib/llm-presets";

interface ModelSelectorProps {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  value: string;
  onChange: (modelId: string) => void;
}

// 用预设元信息（label/tier/price）补充动态拉取的模型 id；匹配不上的给默认值
function enrichModelIds(provider: string, ids: string[]): ModelInfo[] {
  const presetModels = PROVIDER_PRESETS[provider]?.models ?? [];
  const presetMap = new Map(presetModels.map((m) => [m.id, m]));
  return ids.map((id) =>
    presetMap.get(id) ?? { id, label: id, tier: "standard" as const, price: "" },
  );
}

export function ModelSelector({ provider, apiKey, baseUrl, value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  // 动态拉取失败时回退静态列表，并展示警告
  const [fallback, setFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCustom = provider === "custom";

  useEffect(() => {
    if (isCustom) return;
    if (!apiKey) return;
    let cancelled = false;
    setLoading(true);
    setFallback(false);

    fetchLiveModels(provider, apiKey, baseUrl)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.models && res.models.length > 0) {
          setModels(enrichModelIds(provider, res.models));
        } else {
          // 拉取失败或空列表 → 回退静态预设列表
          return getProviderModels(provider).then((presetRes) => {
            if (!cancelled) {
              setModels(presetRes.models);
              setFallback(true);
            }
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        // 网络异常 → 回退静态预设列表
        return getProviderModels(provider)
          .then((presetRes) => {
            if (!cancelled) {
              setModels(presetRes.models);
              setFallback(true);
            }
          })
          .catch(() => {
            if (!cancelled) setModels([]);
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [provider, apiKey, baseUrl, isCustom]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedModel = models.find((m) => m.id === value);

  if (isCustom) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">模型名称</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入模型 ID，如 gpt-4o"
          className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在获取账号可用模型…
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground">选择模型</label>

      {fallback && (
        <div className="flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-500">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          未能获取最新模型列表，显示预设模型
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            open ? "border-ring bg-input" : "border-input-border bg-input hover:border-border-strong",
          )}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {selectedModel ? selectedModel.label : "请选择模型"}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg">
            <div className="max-h-64 overflow-y-auto p-1.5">
              {models.map((model) => {
                const tier = TIER_CONFIG[model.tier];
                const isSelected = model.id === value;
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                      isSelected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <div>
                        <p className="text-sm font-medium">{model.label}</p>
                        <p className="text-xs text-muted-foreground">{model.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tier && (
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", tier.className)}>
                          {tier.label}
                        </span>
                      )}
                      {model.price && (
                        <span className="text-xs text-muted-foreground">{model.price}</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {models.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">未获取到可用模型</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
