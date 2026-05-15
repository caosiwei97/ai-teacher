
import { useState, useEffect, useRef } from "react";

interface QuickQuestionProps {
  sessionId: string;
}

export function QuickQuestion({ sessionId }: QuickQuestionProps) {
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showInput, setShowInput] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) {
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 5) {
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
        setShowInput(false);
        setAnswer("");
      } else if (!popoverRef.current?.contains(e.target as Node)) {
        setSelectedText("");
      }
    }

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  async function handleSubmit() {
    if (!question.trim() || isStreaming) return;
    setIsStreaming(true);
    setAnswer("");

    try {
      const response = await fetch("/api/quick-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          selectedText,
          question,
        }),
      });

      if (!response.ok || !response.body) {
        setAnswer("获取回答失败，请重试");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              const text = JSON.parse(line.slice(2));
              accumulated += text;
              setAnswer(accumulated);
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch {
      setAnswer("获取回答失败，请重试");
    } finally {
      setIsStreaming(false);
    }
  }

  function handleClose() {
    setSelectedText("");
    setShowInput(false);
    setAnswer("");
    setQuestion("");
  }

  if (!selectedText) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%)" }}
    >
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
        >
          快问
        </button>
      ) : (
        <div className="w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-xs text-muted-foreground line-clamp-2">
              选中：「{selectedText.slice(0, 50)}{selectedText.length > 50 ? "…" : ""}」
            </p>
            <button
              onClick={handleClose}
              className="ml-2 shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          {answer ? (
            <div className="text-sm text-foreground whitespace-pre-wrap">{answer}</div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="输入你的问题…"
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                disabled={isStreaming}
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={isStreaming || !question.trim()}
                className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {isStreaming ? "…" : "问"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
