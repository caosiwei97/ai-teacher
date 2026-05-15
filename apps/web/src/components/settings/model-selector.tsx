
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderModels, type ModelInfo } from "@/lib/api-client";
import { TIER_CONFIG } from "@/lib/llm-presets";

interface ModelSelectorProps {
  provider: string;
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ provider, value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCustom = provider === "custom";

  useEffect(() => {
    if (isCustom) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProviderModels(provider)
      .then((res) => {
        if (!cancelled) setModels(res.models);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "获取模型列表失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [provider, isCustom]);

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
          value={customInput}
          onChange={(e) => {
            setCustomInput(e.target.value);
            onChange(e.target.value);
          }}
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
        加载模型列表…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground">选择模型</label>
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
                      <span className="text-xs text-muted-foreground">{model.price}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
