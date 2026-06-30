
import type { UIBlock } from "@ai-teacher/shared";
import type { AssessmentCardProps } from "./assessment-card";
import type { DiagnosticQuestionsData, LoopTrace } from "@/hooks/use-chat-stream";
import { MessageContent } from "@/components/ui-blocks";
import type { InteractiveSubmitPayload } from "@/components/ui-blocks/interactive-block";
import { DiagnosticQuizCard } from "./diagnostic-quiz-card";
import { LoopTracePanel } from "./loop-trace-panel";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  assessment?: AssessmentCardProps;
  uiBlocks?: UIBlock[];
  streamingBlocks?: boolean;
  diagnosticQuestions?: DiagnosticQuestionsData;
  onDiagnosticSubmit?: (answers: Array<{ questionId: string; optionId: string; optionText: string }>) => void;
  onInteractiveSubmit?: (payload: InteractiveSubmitPayload) => void;
  diagnosticSubmitted?: boolean;
  diagnosticAnalyzing?: boolean;
  loopTrace?: LoopTrace;
}

export function ChatMessage({
  role,
  content,
  assessment,
  uiBlocks,
  streamingBlocks,
  diagnosticQuestions,
  onDiagnosticSubmit,
  onInteractiveSubmit,
  diagnosticSubmitted,
  diagnosticAnalyzing,
  loopTrace,
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
      <div className={`${isUser ? "max-w-[80%]" : "w-full"} min-w-0 space-y-3`}>
        {(hasContent || hasBlocks) && (
          <div
            data-testid={isUser ? "user-message-bubble" : undefined}
            className={`text-base leading-relaxed ${
              isUser
                ? "rounded-xl bg-chat-user-bubble px-4 py-3 text-chat-user-text"
                : "text-chat-ai-text"
            }`}
            style={{ animation: 'message-in 300ms cubic-bezier(0.33, 1, 0.68, 1) both' }}
          >
            <MessageContent
              content={content}
              uiBlocks={effectiveBlocks}
              streamingBlocks={streamingBlocks}
              onInteractiveSubmit={onInteractiveSubmit}
            />
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
        {!isUser && loopTrace && loopTrace.steps.length > 0 && (
          <LoopTracePanel trace={loopTrace} />
        )}
      </div>
    </div>
  );
}
