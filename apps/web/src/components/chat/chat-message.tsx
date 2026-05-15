"use client";

import type { UIBlock } from "@ai-teacher/shared";
import type { AssessmentCardProps } from "./assessment-card";
import type { DiagnosticQuestionsData } from "@/hooks/use-chat-stream";
import { MessageContent } from "@/components/ui-blocks";
import { DiagnosticQuizCard } from "./diagnostic-quiz-card";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  assessment?: AssessmentCardProps;
  uiBlocks?: UIBlock[];
  streamingBlocks?: boolean;
  diagnosticQuestions?: DiagnosticQuestionsData;
  onDiagnosticSubmit?: (answers: Array<{ questionId: string; optionId: string; optionText: string }>) => void;
  diagnosticSubmitted?: boolean;
  diagnosticAnalyzing?: boolean;
}

export function ChatMessage({
  role,
  content,
  assessment,
  uiBlocks,
  streamingBlocks,
  diagnosticQuestions,
  onDiagnosticSubmit,
  diagnosticSubmitted,
  diagnosticAnalyzing,
}: ChatMessageProps) {
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

  const hasBlocks = (effectiveBlocks && effectiveBlocks.length > 0) || streamingBlocks;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] space-y-3 ${isUser ? "order-1" : ""}`}>
        {(hasContent || hasBlocks) && (
          <div
            className={`rounded-xl px-4 py-3 text-base leading-relaxed ${
              isUser
                ? "rounded-br-[4px] bg-chat-user-bubble text-chat-user-text"
                : "rounded-bl-[4px] bg-chat-ai-bubble text-chat-ai-text"
            }`}
            style={{ animation: 'message-in 300ms cubic-bezier(0.33, 1, 0.68, 1) both' }}
          >
            <MessageContent content={content} uiBlocks={effectiveBlocks} streamingBlocks={streamingBlocks} />
          </div>
        )}
        {!isUser && diagnosticQuestions && onDiagnosticSubmit && (
          <DiagnosticQuizCard
            questions={diagnosticQuestions.questions}
            title={diagnosticQuestions.question}
            onSubmit={onDiagnosticSubmit}
            submitted={diagnosticSubmitted}
            analyzing={diagnosticAnalyzing}
          />
        )}
      </div>
    </div>
  );
}
