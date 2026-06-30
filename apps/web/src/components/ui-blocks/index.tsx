
import type { UIBlock } from "@ai-teacher/shared";
import { UIBlockRegistry } from "./registry";
import { TextBlock } from "./text-block";
import { BlockSkeleton } from "./block-skeleton";
import { InteractiveBlockRenderer, type InteractiveSubmitPayload } from "./interactive-block";

interface MessageContentProps {
  content: string;
  uiBlocks?: UIBlock[];
  streamingBlocks?: boolean;
  onInteractiveSubmit?: (payload: InteractiveSubmitPayload) => void;
}

export function MessageContent({
  content,
  uiBlocks,
  streamingBlocks,
  onInteractiveSubmit,
}: MessageContentProps) {
  if (!uiBlocks || uiBlocks.length === 0) {
    if (streamingBlocks) {
      return <BlockSkeleton />;
    }
    return <TextBlock block={{ type: "text", content }} />;
  }

  return (
    <>
      {uiBlocks.map((block, i) => {
        if (block.type === "interactive") {
          return (
            <div key={i} className="animate-[fadeSlideIn_0.3s_ease-out_both]">
              <InteractiveBlockRenderer
                block={block}
                onSubmit={onInteractiveSubmit}
              />
            </div>
          );
        }

        const Renderer = UIBlockRegistry[block.type];
        if (!Renderer) return null;
        return (
          <div key={i} className="animate-[fadeSlideIn_0.3s_ease-out_both]">
            <Renderer block={block} />
          </div>
        );
      })}
      {streamingBlocks && <BlockSkeleton />}
    </>
  );
}
