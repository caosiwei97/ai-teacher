
import { useState } from "react";
import { ArrowUp, Lightbulb, Square, ChevronDown } from "lucide-react";
import { ModeSelector, type TeachingMode } from "./mode-selector";

interface LlmConfigOption {
  id: string;
  provider: string;
  defaultModel: string;
  isDefault: boolean;
}

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
  isSuggesting?: boolean;
  suggestion?: string;
  onSuggest?: () => void;
  onApplySuggestion?: () => void;
  onDismissSuggestion?: () => void;
  teachingMode?: TeachingMode;
  onTeachingModeChange?: (mode: TeachingMode) => void;
  currentModel?: string;
  llmConfigs?: LlmConfigOption[];
  selectedConfigId?: string;
  onModelChange?: (configId: string) => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  disabled,
  isSuggesting,
  suggestion,
  onSuggest,
  onApplySuggestion,
  onDismissSuggestion,
  teachingMode = "warm",
  onTeachingModeChange,
  currentModel,
  llmConfigs,
  selectedConfigId,
  onModelChange,
}: ChatInputProps) {
  const [modelOpen, setModelOpen] = useState(false);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (value.trim()) {
      onSubmit(e);
    }
  }

  return (
    <div className="border-t border-border p-4">
      {disabled && (
        <div className="mx-auto mb-2 max-w-3xl rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-500">
          请先在<a href="/settings" className="underline font-medium hover:text-amber-400">设置页</a>配置模型后再开始对话
        </div>
      )}
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <div className="relative rounded-[12px] border border-[var(--color-chat-input-border)] bg-[var(--color-chat-input-bg)] transition-[border-color,box-shadow] duration-200 ease-in-out focus-within:border-[var(--color-chat-input-focus)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-ring)_25%,transparent)]">
          <div className="flex items-start">
            {onTeachingModeChange && (
              <div className="flex shrink-0 items-center pt-4 pl-4">
                <ModeSelector value={teachingMode} onChange={onTeachingModeChange} />
              </div>
            )}
            <textarea
              value={value}
              onChange={onChange}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "请先配置模型…" : "写下你的思考…"}
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent px-4 py-4 pr-12 text-[16px] leading-relaxed text-[var(--color-chat-input-text)] placeholder:text-[var(--color-chat-input-placeholder)] focus:outline-none focus-visible:shadow-none focus-visible:ring-0"
              style={{ minHeight: "56px", maxHeight: "280px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
              }}
            />
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {currentModel && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => llmConfigs && llmConfigs.length > 1 && setModelOpen(!modelOpen)}
                  className="flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] text-[var(--color-chat-input-placeholder)] transition-colors hover:bg-white/10 hover:text-[var(--color-chat-input-text)]"
                >
                  {currentModel}
                  {llmConfigs && llmConfigs.length > 1 && <ChevronDown className="h-2.5 w-2.5" />}
                </button>
                {modelOpen && llmConfigs && llmConfigs.length > 1 && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                    <div className="absolute bottom-full right-0 z-50 mb-1 rounded-lg border border-border bg-popover p-1 shadow-lg" style={{ minWidth: "160px" }}>
                      {llmConfigs.map((config) => (
                        <button
                          key={config.id}
                          type="button"
                          onClick={() => {
                            onModelChange?.(config.id);
                            setModelOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                            config.id === selectedConfigId
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <span className="flex-1 truncate">{config.defaultModel}</span>
                          {config.isDefault && (
                            <span className="text-[10px] text-muted-foreground">默认</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {onSuggest && !isLoading && (
              <button
                type="button"
                onClick={onSuggest}
                disabled={isSuggesting}
                className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[var(--color-chat-input-placeholder)] transition-colors hover:bg-white/10 hover:text-[var(--color-chat-input-text)] disabled:opacity-50"
              >
                <Lightbulb className="h-4 w-4" />
              </button>
            )}
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!value.trim() || disabled}
                className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {suggestion && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-roadmap-fill/30 bg-roadmap-fill/5 px-3 py-2">
            <Lightbulb className="h-4 w-4 shrink-0 text-roadmap-fill" />
            <span className="text-xs text-muted-foreground">{suggestion}</span>
            <button
              type="button"
              onClick={onApplySuggestion}
              className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              采用
            </button>
            <button
              type="button"
              onClick={onDismissSuggestion}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
