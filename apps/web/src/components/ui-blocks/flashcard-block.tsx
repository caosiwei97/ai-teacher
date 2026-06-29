import { useState } from "react";
import type { FlashcardBlock as FlashcardBlockType } from "@ai-teacher/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/chat/code-block";

interface FlashcardBlockProps {
  block: FlashcardBlockType;
}

// 复习抽认卡（spec §3.2）：正面问题 → 翻面答案 → 答对/答错自评。
// 答对/答错由 UI 派发 review-flashcard-answer 事件，learn.tsx 负责 POST /review/result + 推进对话。
export function FlashcardBlockRenderer({ block }: FlashcardBlockProps) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  function handleAnswer(correct: boolean) {
    if (answered) return;
    setAnswered(true);
    window.dispatchEvent(
      new CustomEvent("review-flashcard-answer", {
        detail: { nodeId: block.nodeId, correct },
      }),
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* 头部：抽认卡标识 */}
      <div className="flex items-center gap-2 border-b border-border bg-accent/5 px-4 py-2">
        <span className="text-base">🎴</span>
        <span className="text-xs font-medium text-muted-foreground">复习抽认卡</span>
      </div>

      {/* 正面：问题 */}
      <div className="p-4">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          问题
        </p>
        <div className="text-sm leading-relaxed text-foreground prose-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");
                if (match) return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
                return (
                  <code
                    className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent"
                    {...props}
                  >
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
            }}
          >
            {block.front}
          </ReactMarkdown>
        </div>
      </div>

      {/* 翻面按钮 */}
      {!flipped && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setFlipped(true)}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/10"
          >
            👀 翻面看答案
          </button>
        </div>
      )}

      {/* 背面：答案 + 自评 */}
      {flipped && (
        <>
          <div className="border-t border-border bg-accent/5 p-4">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              答案
            </p>
            <div className="text-sm leading-relaxed text-foreground/90 prose-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");
                    if (match) return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
                    return (
                      <code
                        className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent"
                        {...props}
                      >
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
                }}
              >
                {block.back}
              </ReactMarkdown>
            </div>
          </div>
          <div className="flex gap-2 p-4">
            <button
              onClick={() => handleAnswer(true)}
              disabled={answered}
              className="flex-1 rounded-lg border border-roadmap-fill/30 bg-roadmap-fill/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-roadmap-fill/20 disabled:opacity-50"
            >
              ✓ 答对了
            </button>
            <button
              onClick={() => handleAnswer(false)}
              disabled={answered}
              className="flex-1 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              ✗ 答错了
            </button>
          </div>
          {answered && (
            <p className="px-4 pb-3 text-center text-[11px] text-muted-foreground">
              已记录，准备下一题…
            </p>
          )}
        </>
      )}
    </div>
  );
}
