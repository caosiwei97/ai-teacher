"use client";

import { ArrowUp, Lightbulb, Square } from "lucide-react";
import { ModeSelector, type TeachingMode } from "./mode-selector";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  isLoading: boolean;
  isSuggesting?: boolean;
  suggestion?: string;
  onSuggest?: () => void;
  onApplySuggestion?: () => void;
  onDismissSuggestion?: () => void;
  teachingMode?: TeachingMode;
  onTeachingModeChange?: (mode: TeachingMode) => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  isSuggesting,
  suggestion,
  onSuggest,
  onApplySuggestion,
  onDismissSuggestion,
  teachingMode = "warm",
  onTeachingModeChange,
}: ChatInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (value.trim()) {
      onSubmit(e);
    }
  }

  return (
    <div className="border-t border-border p-4">
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
              placeholder="写下你的思考…"
              rows={1}
              className="flex-1 resize-none bg-transparent px-4 py-4 pr-12 text-[16px] leading-relaxed text-[var(--color-chat-input-text)] placeholder:text-[var(--color-chat-input-placeholder)] focus:outline-none"
              style={{ minHeight: "56px", maxHeight: "280px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
              }}
            />
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
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
                disabled={!value.trim()}
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
