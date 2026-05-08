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
    <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-gray-200 bg-white p-4">
      <textarea
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder="写下你的思考…"
        rows={1}
        className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        style={{ minHeight: "40px", maxHeight: "120px" }}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        }}
      />
      {isLoading ? (
        <Button type="button" onClick={onStop} variant="destructive" size="icon" className="shrink-0">
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={!value.trim()} className="shrink-0">
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
