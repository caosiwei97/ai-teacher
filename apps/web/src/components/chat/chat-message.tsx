"use client";

import type { UIBlock } from "@ai-teacher/shared";
import type { AssessmentCardProps } from "./assessment-card";
import { MessageContent } from "@/components/ui-blocks";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  assessment?: AssessmentCardProps;
  uiBlocks?: UIBlock[];
}

export function ChatMessage({ role, content, assessment, uiBlocks }: ChatMessageProps) {
  const isUser = role === "user";
  const hasContent = content.trim().length > 0;

  // If assessment exists but no uiBlocks, synthesize uiBlocks with assessment
  let effectiveBlocks = uiBlocks;
  if (!isUser && assessment && (!effectiveBlocks || effectiveBlocks.length === 0)) {
    const blocks: UIBlock[] = [];
    if (hasContent) {
      blocks.push({ type: "text", content });
    }
    blocks.push({
      type: "assessment",
      summary: assessment.summary,
      reviewTable: assessment.reviewTable,
      coreTags: assessment.coreTags,
      nextNodeTitle: assessment.nextNodeTitle,
    });
    effectiveBlocks = blocks;
  }

  const hasBlocks = effectiveBlocks && effectiveBlocks.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] space-y-3 ${isUser ? "order-1" : ""}`}>
        {(hasContent || hasBlocks) && (
          <div
            className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
              isUser
                ? "rounded-br-sm bg-chat-user text-chat-user-text"
                : "rounded-bl-sm bg-chat-tutor text-chat-tutor-text shadow-sm"
            }`}
          >
            <MessageContent content={content} uiBlocks={effectiveBlocks} />
          </div>
        )}
      </div>
    </div>
  );
}
