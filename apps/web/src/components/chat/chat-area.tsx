"use client";

import { useRef, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import {
  isAssessmentCardData,
  type AssessmentCardProps,
} from "./assessment-card";
import type { UIBlock } from "@ai-teacher/shared";
import type { MessageMetadata } from "@/hooks/use-chat-stream";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { Sparkles } from "lucide-react";

function getTextFromParts(parts: UIMessage["parts"]): string {
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

interface ChatAreaProps {
  messages: UIMessage<MessageMetadata>[];
  input: string;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  isSuggesting?: boolean;
  suggestion?: string;
  onSuggest?: () => void;
  onApplySuggestion?: () => void;
  onDismissSuggestion?: () => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAssessmentFromAnnotations(
  annotations: MessageMetadata["annotations"],
): AssessmentCardProps | undefined {
  for (const annotation of annotations ?? []) {
    if (!isObject(annotation)) {
      continue;
    }

    if (isAssessmentCardData(annotation.assessment)) {
      return annotation.assessment;
    }

    if (
      annotation.toolName === "generateAssessment" &&
      isAssessmentCardData(annotation.result)
    ) {
      return annotation.result;
    }
  }

  return undefined;
}

function getAssessmentFromMessage(message: UIMessage<MessageMetadata>) {
  return getAssessmentFromAnnotations(message.metadata?.annotations);
}

function getUIBlocksFromMessage(message: UIMessage<MessageMetadata>): UIBlock[] | undefined {
  const annotations = message.metadata?.annotations;
  if (annotations) {
    for (const annotation of annotations) {
      if (isObject(annotation)) {
        const blocks = annotation.uiBlocks;
        if (Array.isArray(blocks) && blocks.length > 0) {
          return blocks as UIBlock[];
        }
      }
    }
  }
  return undefined;
}

export function ChatArea({
  messages,
  input,
  isLoading,
  onInputChange,
  onSubmit,
  onStop,
  isSuggesting,
  suggestion,
  onSuggest,
  onApplySuggestion,
  onDismissSuggestion,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
              <Sparkles className="h-6 w-6 text-roadmap-fill" />
            </div>
            <p className="text-sm">开始你的学习之旅吧</p>
          </div>
        )}
        {messages.map((msg) => {
          if (msg.role !== "user" && msg.role !== "assistant") {
            return null;
          }

          return (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={getTextFromParts(msg.parts)}
              assessment={msg.role === "assistant" ? getAssessmentFromMessage(msg) : undefined}
              uiBlocks={msg.role === "assistant" ? getUIBlocksFromMessage(msg) : undefined}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        onStop={onStop}
        isLoading={isLoading}
        isSuggesting={isSuggesting}
        suggestion={suggestion}
        onSuggest={onSuggest}
        onApplySuggestion={onApplySuggestion}
        onDismissSuggestion={onDismissSuggestion}
      />
    </div>
  );
}
