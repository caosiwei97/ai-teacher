
import type { HeadingBlock as HeadingBlockType } from "@ai-teacher/shared";

interface HeadingBlockProps {
  block: HeadingBlockType;
}

export function HeadingBlock({ block }: HeadingBlockProps) {
  if (block.level === 2) {
    return <h2 className="text-lg font-bold text-foreground mt-4 mb-2 whitespace-nowrap overflow-x-auto">{block.text}</h2>;
  }
  return <h3 className="text-base font-semibold text-foreground mt-3 mb-1.5 whitespace-nowrap overflow-x-auto">{block.text}</h3>;
}
