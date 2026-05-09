"use client";

import type { UIBlock } from "@ai-teacher/shared";
import { UIBlockRegistry } from "./registry";
import { TextBlock } from "./text-block";

interface MessageContentProps {
  content: string;
  uiBlocks?: UIBlock[];
}

export function MessageContent({ content, uiBlocks }: MessageContentProps) {
  if (!uiBlocks || uiBlocks.length === 0) {
    return <TextBlock block={{ type: "text", content }} />;
  }

  return (
    <>
      {uiBlocks.map((block, i) => {
        const Renderer = UIBlockRegistry[block.type];
        if (!Renderer) return null;
        return <Renderer key={i} block={block} />;
      })}
    </>
  );
}
