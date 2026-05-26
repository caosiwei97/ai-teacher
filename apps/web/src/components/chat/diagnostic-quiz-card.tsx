
import { useState, useMemo } from "react";
import { Check, ArrowRight, Loader2 } from "lucide-react";

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
  analyzing?: boolean;
}

export function DiagnosticQuizCard({
  questions,
  title,
  onSubmit,
  submitted = false,
  analyzing = false,
}: DiagnosticQuizCardProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [answers, setAnswers] = useState<
    Map<string, { optionId: string; optionText: string }>
  >(new Map());
  const [customInput, setCustomInput] = useState<Map<string, string>>(new Map());

  const tabLabels = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const q of questions) {
      countMap.set(q.title, (countMap.get(q.title) ?? 0) + 1);
    }
    const indexMap = new Map<string, number>();
    return questions.map((q) => {
      const count = countMap.get(q.title) ?? 1;
      if (count === 1) return q.title;
      const idx = (indexMap.get(q.title) ?? 0) + 1;
      indexMap.set(q.title, idx);
      return `${q.title}${String.fromCodePoint(0x245f + idx)}`;
    });
  }, [questions]);

  const currentQuestion = questions[activeTab];
  const allAnswered = questions.every((q) => answers.has(q.id));
  const currentAnswer = answers.get(currentQuestion?.id);
  const disabled = submitted || analyzing;

  function handleSelectOption(questionId: string, optionId: string, optionText: string) {
    if (disabled) return;
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, { optionId, optionText });
    setAnswers(newAnswers);
    setCustomInput((prev) => {
      const next = new Map(prev);
      next.delete(questionId);
      return next;
    });

    // Auto-advance to next unanswered question
    const currentIdx = questions.findIndex((q) => q.id === questionId);
    for (let i = currentIdx + 1; i < questions.length; i++) {
      if (!newAnswers.has(questions[i].id)) {
        setActiveTab(i);
        return;
      }
    }
    // Wrap around to first unanswered
    for (let i = 0; i < currentIdx; i++) {
      if (!newAnswers.has(questions[i].id)) {
        setActiveTab(i);
        return;
      }
    }
  }

  function handleCustomInput(questionId: string, text: string) {
    if (disabled) return;
    setCustomInput((prev) => {
      const next = new Map(prev);
      next.set(questionId, text);
      return next;
    });
    if (text.trim()) {
      const newAnswers = new Map(answers);
      newAnswers.set(questionId, { optionId: "custom", optionText: text.trim() });
      setAnswers(newAnswers);

      // Auto-advance to next unanswered question
      const currentIdx = questions.findIndex((q) => q.id === questionId);
      for (let i = currentIdx + 1; i < questions.length; i++) {
        if (!newAnswers.has(questions[i].id)) {
          setActiveTab(i);
          return;
        }
      }
    } else {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  function handleSubmit() {
    if (!allAnswered || disabled) return;
    const result = questions.map((q) => {
      const answer = answers.get(q.id)!;
      return { questionId: q.id, optionId: answer.optionId, optionText: answer.optionText };
    });
    onSubmit(result);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border bg-secondary/30">
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>

      <div className="flex overflow-x-auto border-b border-border">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors relative ${
              i === activeTab
                ? "text-roadmap-fill border-b-2 border-roadmap-fill"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {answers.has(q.id) && (
              <Check className="h-3 w-3 text-roadmap-mastered" />
            )}
            {tabLabels[i]}
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
                disabled={disabled}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-all ${
                  currentAnswer?.optionId === opt.id
                    ? "border-roadmap-fill bg-roadmap-fill/5 text-foreground"
                    : disabled
                      ? "border-border bg-background text-foreground cursor-default"
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
                  readOnly={disabled}
                  placeholder="其他（自由输入）"
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-[13px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-secondary/20">
        {submitted ? (
          <>
            <span className="text-xs text-muted-foreground">
              {questions.length}/{questions.length} 已回答
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-roadmap-mastered">
              <Check className="h-3.5 w-3.5" />
              <span>已提交</span>
            </div>
          </>
        ) : analyzing ? (
          <>
            <span className="text-xs text-muted-foreground">
              {answers.size}/{questions.length} 已回答
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-roadmap-fill">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>正在分析你的水平…</span>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
