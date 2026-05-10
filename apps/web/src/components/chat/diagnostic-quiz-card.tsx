"use client";

import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  title: string;
  options: Array<{ id: string; text: string }>;
}

interface DiagnosticQuizCardProps {
  questions: QuizQuestion[];
  title: string;
  onSubmit: (answers: Array<{ questionId: string; optionId: string; optionText: string }>) => void;
  submitted?: boolean;
}

export function DiagnosticQuizCard({
  questions,
  title,
  onSubmit,
  submitted = false,
}: DiagnosticQuizCardProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [answers, setAnswers] = useState<
    Map<string, { optionId: string; optionText: string }>
  >(new Map());
  const [customInput, setCustomInput] = useState<Map<string, string>>(new Map());

  const currentQuestion = questions[activeTab];
  const allAnswered = questions.every((q) => answers.has(q.id));
  const currentAnswer = answers.get(currentQuestion?.id);

  function handleSelectOption(questionId: string, optionId: string, optionText: string) {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, { optionId, optionText });
      return next;
    });
    setCustomInput((prev) => {
      const next = new Map(prev);
      next.delete(questionId);
      return next;
    });
  }

  function handleCustomInput(questionId: string, text: string) {
    setCustomInput((prev) => {
      const next = new Map(prev);
      next.set(questionId, text);
      return next;
    });
    if (text.trim()) {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, { optionId: "custom", optionText: text.trim() });
        return next;
      });
    } else {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  function handleSubmit() {
    if (!allAnswered) return;
    const result = questions.map((q) => {
      const answer = answers.get(q.id)!;
      return { questionId: q.id, optionId: answer.optionId, optionText: answer.optionText };
    });
    onSubmit(result);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-roadmap-mastered" />
          <span>已提交</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border bg-secondary/30">
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>

      <div className="flex border-b border-border">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative ${
              i === activeTab
                ? "text-roadmap-fill border-b-2 border-roadmap-fill"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {answers.has(q.id) && (
              <Check className="h-3 w-3 text-roadmap-mastered" />
            )}
            {q.title}
          </button>
        ))}
      </div>

      {currentQuestion && (
        <div className="p-4">
          <p className="mb-4 text-sm leading-relaxed text-foreground">
            {currentQuestion.question}
          </p>

          <div className="space-y-2">
            {currentQuestion.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  handleSelectOption(currentQuestion.id, opt.id, opt.text)
                }
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-all ${
                  currentAnswer?.optionId === opt.id
                    ? "border-roadmap-fill bg-roadmap-fill/5 text-foreground"
                    : "border-border bg-background text-foreground hover:border-roadmap-fill/50"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                    currentAnswer?.optionId === opt.id
                      ? "bg-roadmap-fill text-white"
                      : "border border-input text-muted-foreground"
                  }`}
                >
                  {opt.id.toUpperCase()}
                </span>
                <span className="leading-relaxed">{opt.text}</span>
              </button>
            ))}

            <div className="rounded-lg border border-dashed border-border overflow-hidden">
              <div
                className={`flex items-start gap-3 px-3 py-2.5 text-[13px] transition-colors ${
                  currentAnswer?.optionId === "custom"
                    ? "border-roadmap-fill bg-roadmap-fill/5"
                    : "bg-background"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                    currentAnswer?.optionId === "custom"
                      ? "bg-roadmap-fill text-white"
                      : "border border-input text-muted-foreground"
                  }`}
                >
                  ✎
                </span>
                <input
                  type="text"
                  value={customInput.get(currentQuestion.id) ?? ""}
                  onChange={(e) =>
                    handleCustomInput(currentQuestion.id, e.target.value)
                  }
                  placeholder="其他（自由输入）"
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-[13px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-secondary/20">
        <span className="text-xs text-muted-foreground">
          {answers.size}/{questions.length} 已回答
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
            allAnswered
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {allAnswered ? "提交" : "请回答所有问题"}
          {allAnswered && <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
