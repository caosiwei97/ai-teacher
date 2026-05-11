"use client";

import type { CalloutBlock as CalloutBlockType } from "@ai-teacher/shared";

interface CalloutBlockProps {
  block: CalloutBlockType;
}

const VARIANT_STYLES: Record<CalloutBlockType["variant"], string> = {
  tip: "border-l-roadmap-mastered bg-roadmap-mastered/5",
  warning: "border-l-accent bg-accent/5",
  key: "border-l-primary bg-primary/5",
};

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

export function CalloutBlock({ block }: CalloutBlockProps) {
  const variantStyle = VARIANT_STYLES[block.variant];

  return (
    <div className={`rounded-lg border-l-4 p-4 ${variantStyle}`}>
      {block.title && (
        <p className="mb-1 text-sm font-bold text-foreground">
          {block.title}
        </p>
      )}
      <p className="text-sm leading-relaxed text-foreground/90">
        {renderInlineCode(block.content)}
      </p>
    </div>
  );
}
