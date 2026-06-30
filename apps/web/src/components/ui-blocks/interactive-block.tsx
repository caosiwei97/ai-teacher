import { useState } from "react";
import type { InteractiveBlock as InteractiveBlockType } from "@ai-teacher/shared";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/chat/code-block";
import { ArrowRight, Check, Loader2, X } from "lucide-react";

// 互动教学产物渲染器（结构化三段式：概念 / 动手感受 / 自测）。
// 改造自原 iframe+HTML 方案：LLM 只生成结构化 JSON，前端 React 渲染，
// 解决生成慢、图片撑破布局、iframe postMessage 提交竞态三个问题（见 ADR）。

interface InteractiveBlockProps {
  block: InteractiveBlockType;
  onSubmit?: (payload: InteractiveSubmitPayload) => void;
}

export interface InteractiveSubmitPayload {
  answer?: string;
  feedback?: string;
  source: "iframe" | "manual";
}

// markdown 渲染配置（复用 callout-block 模式）
const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");
    if (match) return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
    return (
      <code className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent" {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  p({ children }) {
    return <p className="mb-1 last:mb-0">{children}</p>;
  },
};

export function InteractiveBlockRenderer({ block, onSubmit }: InteractiveBlockProps) {
  const [submitted, setSubmitted] = useState(false);
  // explore 交互的本地状态
  const [sliderValues, setSliderValues] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    block.explore.forEach((item, i) => {
      if (item.kind === "slider") map[i] = item.initial;
    });
    return map;
  });
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  // quiz 作答
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);

  const isCorrect = selectedId === block.quiz.correctId;
  const canSubmit = revealed; // 必须先作答再提交

  function handleSelectOption(optionId: string) {
    if (submitted || revealed) return;
    setSelectedId(optionId);
    setRevealed(true);
  }

  function handleManualSubmit() {
    if (submitted || !revealed) return;
    setSubmitted(true);
    const selectedOption = block.quiz.options.find((o) => o.id === selectedId);
    onSubmit?.({
      source: "manual",
      answer: selectedOption?.text,
      feedback: `${isCorrect ? "答对" : "答错"}：${block.quiz.explanation}`,
    });
  }

  return (
    <div
      data-testid="interactive-lesson-card"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 pb-2 pt-3">
        <span className="text-base">🎯</span>
        <span className="text-xs font-medium text-muted-foreground">互动练习</span>
        <span className="text-sm font-medium text-foreground">· {block.title}</span>
      </div>

      <div className="space-y-4 bg-background/40 p-4">
        {/* ① 概念 */}
        <div className="text-sm leading-relaxed text-foreground/90 prose-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {block.concept}
          </ReactMarkdown>
        </div>

        {/* ② 动手感受 */}
        {block.explore.length > 0 && (
          <div className="space-y-3">
            {block.explore.map((item, i) => {
              if (item.kind === "slider") {
                const val = sliderValues[i] ?? item.initial;
                return (
                  <div key={i} data-testid={`interactive-explore-${i}`}>
                    <label className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.label}</span>
                      <span className="font-medium text-foreground">
                        {val}
                        {item.unit ?? ""}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={item.min}
                      max={item.max}
                      step={item.step}
                      value={val}
                      onChange={(e) =>
                        setSliderValues((prev) => ({ ...prev, [i]: Number(e.target.value) }))
                      }
                      disabled={submitted}
                      className="w-full accent-[var(--color-roadmap-fill)]"
                    />
                  </div>
                );
              }
              // input
              return (
                <div key={i} data-testid={`interactive-explore-${i}`}>
                  <label className="mb-1.5 block text-xs text-muted-foreground">{item.label}</label>
                  <input
                    type="text"
                    value={inputValues[i] ?? ""}
                    placeholder={item.placeholder}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, [i]: e.target.value }))
                    }
                    readOnly={submitted}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-roadmap-fill focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ③ 自测 */}
        <div data-testid="interactive-quiz">
          <p className="mb-3 text-sm leading-relaxed text-foreground">{block.quiz.question}</p>
          <div className="space-y-2">
            {block.quiz.options.map((opt) => {
              const isSelected = selectedId === opt.id;
              const showCorrect = revealed && opt.id === block.quiz.correctId;
              const showWrong = revealed && isSelected && opt.id !== block.quiz.correctId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`interactive-option-${opt.id}`}
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={submitted || revealed}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-all ${
                    showCorrect
                      ? "border-roadmap-mastered bg-roadmap-mastered/5 text-foreground"
                      : showWrong
                        ? "border-accent bg-accent/5 text-foreground"
                        : isSelected
                          ? "border-roadmap-fill bg-roadmap-fill/5 text-foreground"
                          : "border-border bg-background text-foreground hover:border-roadmap-fill/50"
                  } ${revealed ? "cursor-default" : "cursor-pointer"}`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                      showCorrect
                        ? "bg-roadmap-mastered text-white"
                        : showWrong
                          ? "bg-accent text-white"
                          : "border border-input text-muted-foreground"
                    }`}
                  >
                    {showCorrect ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : showWrong ? (
                      <X className="h-2.5 w-2.5" />
                    ) : (
                      opt.id.toUpperCase()
                    )}
                  </span>
                  <span className="leading-relaxed">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* 作答后的即时反馈 */}
          {revealed && (
            <div
              data-testid="interactive-quiz-feedback"
              className={`mt-3 rounded-lg border-l-4 p-3 text-sm leading-relaxed ${
                isCorrect
                  ? "border-l-roadmap-mastered bg-roadmap-mastered/5 text-foreground/90"
                  : "border-l-accent bg-accent/5 text-foreground/90"
              }`}
            >
              <p className="mb-1 font-medium">
                {isCorrect ? "✅ 答对了" : "❌ 再想想"}
              </p>
              <div className="prose-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {block.quiz.explanation}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border bg-secondary/20 px-4 py-3">
        {submitted ? (
          <>
            <span className="text-xs text-muted-foreground">自测已提交</span>
            <div
              data-testid="interactive-submit-status"
              className="flex items-center gap-1.5 text-xs font-medium text-roadmap-mastered"
            >
              <Check className="h-3.5 w-3.5" />
              <span>已提交</span>
            </div>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-roadmap-fill" />
              等待作答
            </span>
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={!canSubmit}
              data-testid="interactive-complete-button"
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                canSubmit
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              完成自测
              {canSubmit && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
