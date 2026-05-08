"use client";

import { useRef, useEffect } from "react";
import type { Message } from "ai";
import {
  isAssessmentCardData,
  type AssessmentCardProps,
} from "./assessment-card";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

interface ChatAreaProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getArrayProperty(value: unknown, key: string) {
  if (!isObject(value)) {
    return undefined;
  }

  const property = value[key];
  return Array.isArray(property) ? property : undefined;
}

function getAssessmentFromAnnotations(
  annotations: unknown[] | undefined,
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

function getAssessmentFromToolInvocations(
  toolInvocations: unknown[] | undefined,
): AssessmentCardProps | undefined {
  for (const invocation of toolInvocations ?? []) {
    if (!isObject(invocation)) {
      continue;
    }

    if (
      invocation.toolName === "generateAssessment" &&
      invocation.state === "result" &&
      isAssessmentCardData(invocation.result)
    ) {
      return invocation.result;
    }
  }

  return undefined;
}

function getAssessmentFromMessage(message: Message) {
  return (
    getAssessmentFromAnnotations(getArrayProperty(message, "annotations")) ??
    getAssessmentFromToolInvocations(getArrayProperty(message, "toolInvocations"))
  );
}

export function ChatArea({ messages, input, isLoading, onInputChange, onSubmit, onStop }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-5 py-4">
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
              content={msg.content}
              assessment={msg.role === "assistant" ? getAssessmentFromMessage(msg) : undefined}
            />
          );
        })}
        <div ref={bottomRef} />
      </ScrollArea>
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        onStop={onStop}
        isLoading={isLoading}
      />
    </div>
  );
}
