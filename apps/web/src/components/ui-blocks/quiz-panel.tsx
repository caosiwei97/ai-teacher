
import { useState } from "react";
import type { QuizBlock } from "@ai-teacher/shared";

interface QuizPanelProps {
  block: QuizBlock;
}

export function QuizPanel({ block }: QuizPanelProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  function handleSelect(questionIndex: number, optionIndex: number) {
    if (answers[questionIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      {block.questions.map((q, qi) => {
        const answered = answers[qi] !== undefined;
        const selected = answers[qi];
        const isCorrect = selected === q.correctIndex;

        return (
          <div key={qi} className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                let optionClass = "border-border bg-secondary/50 hover:bg-secondary";
                if (answered) {
                  if (oi === q.correctIndex) {
                    optionClass = "border-roadmap-mastered bg-roadmap-mastered/10";
                  } else if (oi === selected) {
                    optionClass = "border-destructive bg-destructive/10";
                  } else {
                    optionClass = "border-border bg-secondary/30 opacity-60";
                  }
                }

                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={answered}
                    onClick={() => handleSelect(qi, oi)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm text-foreground transition-colors ${optionClass} disabled:cursor-default`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-medium">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {answered && (
              <p className={`text-xs font-medium ${isCorrect ? "text-roadmap-mastered" : "text-destructive"}`}>
                {isCorrect ? "正确!" : "再想想..."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
