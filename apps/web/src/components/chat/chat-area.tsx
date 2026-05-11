"use client";

import { useRef, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import {
  isAssessmentCardData,
  type AssessmentCardProps,
} from "./assessment-card";
import type { UIBlock } from "@ai-teacher/shared";
import type { MessageMetadata, DiagnosticQuestionsData } from "@/hooks/use-chat-stream";
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

interface LlmConfigOption {
  id: string;
  provider: string;
  defaultModel: string;
  isDefault: boolean;
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
  onDiagnosticSubmit?: (answers: Array<{ questionId: string; optionId: string; optionText: string }>) => void;
  diagnosticSubmitted?: boolean;
  diagnosticAnalyzing?: boolean;
  teachingMode?: "warm" | "strict" | "interviewer";
  onTeachingModeChange?: (mode: "warm" | "strict" | "interviewer") => void;
  error?: string | null;
  welcomeContent?: React.ReactNode;
  currentModel?: string;
  llmConfigs?: LlmConfigOption[];
  selectedConfigId?: string;
  onModelChange?: (configId: string) => void;
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

function hasToolCallPending(message: UIMessage<MessageMetadata>, toolName: string): boolean {
  const annotations = message.metadata?.annotations;
  if (!annotations) return false;
  const hasCall = annotations.some(
    (a) => isObject(a) && a.toolName === toolName && "args" in a,
  );
  const hasResult = annotations.some(
    (a) => isObject(a) && a.toolName === toolName && "result" in a,
  );
  return hasCall && !hasResult;
}

function getDiagnosticQuestionsFromMessage(message: UIMessage<MessageMetadata>): DiagnosticQuestionsData | undefined {
  const annotations = message.metadata?.annotations;
  if (annotations) {
    for (const annotation of annotations) {
      if ("diagnosticQuestions" in annotation && annotation.diagnosticQuestions) {
        const dq = annotation.diagnosticQuestions as DiagnosticQuestionsData;
        if (dq && Array.isArray(dq.questions) && dq.questions.length > 0) {
          return dq;
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
  onDiagnosticSubmit,
  diagnosticSubmitted,
  diagnosticAnalyzing,
  teachingMode,
  onTeachingModeChange,
  error,
  welcomeContent,
  currentModel,
  llmConfigs,
  selectedConfigId,
  onModelChange,
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
        className="flex-1 overflow-y-auto px-6 py-6"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 24px, black calc(100% - 24px), transparent 100%)' }}
      >
        {messages.length === 0 && welcomeContent}
        {messages.length === 0 && !welcomeContent && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm">开始你的学习之旅吧</p>
          </div>
        )}
        {messages.map((msg) => {
          if (msg.role !== "user" && msg.role !== "assistant") {
            return null;
          }

          const diagnosticQuestions = msg.role === "assistant" ? getDiagnosticQuestionsFromMessage(msg) : undefined;

          return (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={getTextFromParts(msg.parts)}
              assessment={msg.role === "assistant" ? getAssessmentFromMessage(msg) : undefined}
              uiBlocks={msg.role === "assistant" ? getUIBlocksFromMessage(msg) : undefined}
              diagnosticQuestions={diagnosticQuestions}
              onDiagnosticSubmit={diagnosticQuestions ? onDiagnosticSubmit : undefined}
              diagnosticSubmitted={diagnosticSubmitted}
              diagnosticAnalyzing={diagnosticAnalyzing}
            />
          );
        })}
        {isLoading && messages.length > 0 && (() => {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role !== "assistant") return null;

          const lastText = lastMsg.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") ?? "";
          const hasDiagnosticQuestions = getDiagnosticQuestionsFromMessage(lastMsg) !== undefined;
          const isFirstAssistantMsg = messages.filter((m) => m.role === "assistant").length === 1;

          let label = "";
          if (hasToolCallPending(lastMsg, "askQuestion")) {
            label = "老师正在给你出题中…";
          } else if (lastText.trim() && isFirstAssistantMsg && !hasDiagnosticQuestions) {
            label = "老师正在给你出题中…";
          } else {
            if (lastText.trim()) return null;
            label = "老师正在思考中…";
          }

          return (
            <div className="flex justify-start mb-4">
              <div className="rounded-xl rounded-bl-[4px] bg-chat-ai-bubble px-5 py-4 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-chat-thinking" style={{ animation: 'pulse-dot 1.4s ease-in-out infinite', animationDelay: '0s' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-chat-thinking" style={{ animation: 'pulse-dot 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-chat-thinking" style={{ animation: 'pulse-dot 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
                </div>
                <span className="text-[13px] text-chat-ai-text">{label}</span>
              </div>
            </div>
          );
        })()}
        <div ref={bottomRef} />
      </div>
      <div className="flex flex-col">
        {error && (
          <div className="px-5 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
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
          teachingMode={teachingMode}
          onTeachingModeChange={onTeachingModeChange}
          currentModel={currentModel}
          llmConfigs={llmConfigs}
          selectedConfigId={selectedConfigId}
          onModelChange={onModelChange}
        />
      </div>
    </div>
  );
}
