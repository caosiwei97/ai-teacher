"use client";

import { Button } from "@/components/ui/button";
import { ArrowUp, Lightbulb, Square } from "lucide-react";

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
}: ChatInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit(e);
      }
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-3 border-t border-border bg-card px-5 py-4"
    >
      <div className="relative flex-1">
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder="写下你的思考…"
          rows={1}
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-roadmap-fill focus:outline-none focus:ring-1 focus:ring-roadmap-fill"
          style={{ minHeight: "44px", maxHeight: "120px" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />
      </div>
      {suggestion ? (
        <div className="flex items-center gap-2 rounded-xl border border-roadmap-fill/30 bg-roadmap-fill/5 px-3 py-2">
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
      ) : (
        <div className="flex shrink-0 gap-1">
          {onSuggest && !isLoading && (
            <Button
              type="button"
              onClick={onSuggest}
              variant="ghost"
              size="icon"
              disabled={isSuggesting}
              className="h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Lightbulb className="h-4 w-4" />
            </Button>
          )}
          {isLoading ? (
            <Button
              type="button"
              onClick={onStop}
              variant="destructive"
              size="icon"
              className="h-11 w-11 rounded-xl"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!value.trim()}
              className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
