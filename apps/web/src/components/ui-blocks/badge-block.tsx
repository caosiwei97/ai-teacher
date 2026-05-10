"use client";

import type { BadgeBlock as BadgeBlockType } from "@ai-teacher/shared";

interface BadgeBlockProps {
  block: BadgeBlockType;
}

const VARIANT_STYLES: Record<BadgeBlockType["items"][number]["variant"], string> = {
  success: "bg-roadmap-mastered/10 text-roadmap-mastered",
  warning: "bg-amber-500/10 text-amber-500",
  info: "bg-chat-accent/10 text-chat-accent",
};

export function BadgeBlock({ block }: BadgeBlockProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {block.items.map((item, i) => (
        <span
          key={i}
          className={`rounded-full px-3 py-1 text-xs font-medium ${VARIANT_STYLES[item.variant]}`}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}
