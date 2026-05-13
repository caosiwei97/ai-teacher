"use client";

import { useState, useCallback, useRef } from "react";
import { CodeEditor } from "@/components/editor/code-editor";
import { TerminalPanel } from "@/components/editor/terminal-panel";
import { ResizableDivider } from "@/components/layout/resizable-divider";
import { useCodeExec } from "@/hooks/use-code-exec";
import { Play, Loader2, Trash2, Copy, Check } from "lucide-react";

interface CodePanelProps {
  code: string;
  language: string;
  instruction?: string;
  onCodeChange: (code: string) => void;
  llmConfigId?: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
};

const JUDGE0_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  typescript: 74,
  java: 62,
  cpp: 54,
};

const EDITOR_MIN = 100;
const TERMINAL_MIN = 80;

export function CodePanel({ code, language, instruction, onCodeChange, llmConfigId }: CodePanelProps) {
  const [currentCode, setCurrentCode] = useState(code);
  const { execute, result, isExecuting, error } = useCodeExec();
  const [copied, setCopied] = useState(false);
  const [editorRatio, setEditorRatio] = useState(0.6);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  function handleCodeChange(value: string) {
    setCurrentCode(value);
    onCodeChange(value);
  }

  function handleClear() {
    setCurrentCode("");
    onCodeChange("");
  }

  async function handleRun() {
    const langId = JUDGE0_IDS[language] ?? 63;
    await execute(currentCode, langId, undefined, llmConfigId);
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [currentCode]);

  const handleResize = useCallback((delta: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const totalHeight = container.clientHeight;
    if (totalHeight <= 0) return;

    setEditorRatio((prev) => {
      const currentPx = prev * totalHeight;
      const newPx = currentPx + delta;
      const clampedPx = Math.max(EDITOR_MIN, Math.min(totalHeight - TERMINAL_MIN, newPx));
      return clampedPx / totalHeight;
    });
  }, []);

  const editorHeight = splitContainerRef.current
    ? `${Math.round(editorRatio * splitContainerRef.current.clientHeight)}px`
    : "60%";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-medium text-roadmap-fill">
          {LANGUAGE_LABELS[language] ?? language}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="复制代码"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="清空"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={handleRun}
            disabled={isExecuting || !currentCode.trim()}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-green-500/10 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title="运行"
          >
            {isExecuting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {instruction && (
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs leading-relaxed text-amber-500 bg-amber-500/5 px-3 py-2 rounded-lg">
            💡 {instruction}
          </p>
        </div>
      )}

      <div ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col">
        <div style={{ height: editorHeight }} className="shrink-0 overflow-hidden">
          <CodeEditor
            key={code}
            language={language}
            value={currentCode}
            onChange={handleCodeChange}
          />
        </div>

        <ResizableDivider direction="vertical" onResize={handleResize} />

        <div className="min-h-[80px] flex-1 overflow-y-auto">
          <TerminalPanel result={result} error={error} isExecuting={isExecuting} />
        </div>
      </div>
    </div>
  );
}
