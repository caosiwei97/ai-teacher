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
    <div className="border-t border-border bg-card px-4 py-3">
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-background px-3 py-2 transition-colors focus-within:border-roadmap-fill focus-within:ring-1 focus-within:ring-roadmap-fill">
          {onTeachingModeChange && (
            <div className="flex shrink-0 items-end pb-0.5">
              <ModeSelector value={teachingMode} onChange={onTeachingModeChange} />
            </div>
          )}
          <textarea
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder="你想学什么？"
            rows={1}
            className="flex-1 resize-none bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{ minHeight: "24px", maxHeight: "200px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
          />
          <div className="flex shrink-0 items-end gap-1 pb-0.5">
            {onSuggest && !isLoading && (
              <button
                type="button"
                onClick={onSuggest}
                disabled={isSuggesting}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <Lightbulb className="h-4 w-4" />
              </button>
            )}
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!value.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
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
