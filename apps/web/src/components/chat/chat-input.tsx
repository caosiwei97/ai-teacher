"use client";

import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSubmit, onStop, isLoading }: ChatInputProps) {
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
      {isLoading ? (
        <Button
          type="button"
          onClick={onStop}
          variant="destructive"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!value.trim()}
          className="h-11 w-11 shrink-0 rounded-xl bg-primary hover:bg-primary/90"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
