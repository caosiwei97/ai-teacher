
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, ArrowRight, Loader2 } from "lucide-react";

interface DiagnosticQuestion {
  id: string;
  nodeIndex: number;
  question: string;
  type: "choice" | "open";
  options: Array<{ label: string; text: string }>;
  correctAnswer: string;
}

interface DiagnosticQuizProps {
  questions: DiagnosticQuestion[];
  onSubmit: (answers: Array<{ questionId: string; answer: string }>) => void;
  isSubmitting: boolean;
}

export function DiagnosticQuiz({
  questions,
  onSubmit,
  isSubmitting,
}: DiagnosticQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Map<string, string>
  >(new Map());

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const currentAnswer = answers.get(question.id) ?? "";
  const answeredCount = answers.size;

  function handleChoiceSelect(label: string) {
    setAnswers((prev) => new Map(prev).set(question.id, label));
  }

  function handleOpenAnswer(text: string) {
    setAnswers((prev) => new Map(prev).set(question.id, text));
  }

  function handleNext() {
    if (isLast) {
      const result = Array.from(answers.entries()).map(
        ([questionId, answer]) => ({ questionId, answer }),
      );
      onSubmit(result);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-5 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-2">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < currentIndex
                    ? "bg-roadmap-mastered"
                    : i === currentIndex
                      ? "bg-roadmap-fill"
                      : "bg-roadmap-track"
                }`}
              />
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              第 {currentIndex + 1}/{questions.length} 题
            </span>
            <span className="text-xs text-muted-foreground">
              已答 {answeredCount}/{questions.length}
            </span>
          </div>

          <h3 className="mb-6 text-lg font-medium leading-relaxed text-foreground">
            {question.question}
          </h3>

          {question.type === "choice" ? (
            <div className="space-y-3">
              {question.options.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleChoiceSelect(opt.label)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    currentAnswer === opt.label
                      ? "border-roadmap-fill bg-roadmap-fill/5 text-foreground"
                      : "border-border bg-card text-foreground hover:border-roadmap-fill/50 hover:bg-roadmap-fill/5"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      currentAnswer === opt.label
                        ? "bg-roadmap-fill text-white"
                        : "border border-input text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="leading-relaxed">{opt.text}</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <textarea
                value={currentAnswer}
                onChange={(e) => handleOpenAnswer(e.target.value)}
                placeholder="用 1-2 句话写下你的理解…"
                rows={3}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-roadmap-fill focus:outline-none focus:ring-1 focus:ring-roadmap-fill"
              />
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  className="p-0.5"
                >
                  {answers.has(q.id) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-roadmap-mastered" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-card px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="text-muted-foreground"
          >
            上一题
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            disabled={!currentAnswer.trim()}
            className="gap-2 rounded-xl bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                评估中…
              </>
            ) : isLast ? (
              <>
                提交评估
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                下一题
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
