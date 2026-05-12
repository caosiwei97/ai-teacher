"use client";

import type { ComparisonCardBlock as ComparisonCardType } from "@ai-teacher/shared";

interface ComparisonCardProps {
  block: ComparisonCardType;
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ComparisonCard({ block }: ComparisonCardProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {block.title && (
        <div className="border-b border-border bg-muted/40 px-4 py-2">
          <h4 className="text-sm font-semibold text-roadmap-fill whitespace-nowrap">
            {renderInlineCode(block.title)}
          </h4>
        </div>
      )}
      <div className="grid grid-cols-2 border-b border-border">
        <div className="bg-chat-accent/5 px-4 py-2 text-xs font-semibold text-chat-accent">
          A
        </div>
        <div className="bg-roadmap-fill/5 px-4 py-2 text-xs font-semibold text-roadmap-fill">
          B
        </div>
      </div>
      {block.items.map((item, i) => (
        <div key={i}>
          <div className="border-b border-border/50 bg-muted/20 px-4 py-1.5 text-xs font-semibold text-foreground">
            {item.label}
          </div>
          <div className={`grid grid-cols-2 border-b border-border/50 ${i === block.items.length - 1 ? "border-b-0" : ""}`}>
            <div className="px-4 py-2 text-sm text-foreground">
              {renderInlineCode(item.left)}
            </div>
            <div className="border-l border-border/50 px-4 py-2 text-sm text-foreground">
              {renderInlineCode(item.right)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
