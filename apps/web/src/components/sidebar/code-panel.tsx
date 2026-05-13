"use client";

import { useState, useCallback } from "react";
import { CodeEditor } from "@/components/editor/code-editor";
import { TerminalPanel } from "@/components/editor/terminal-panel";
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

export function CodePanel({ code, language, instruction, onCodeChange, llmConfigId }: CodePanelProps) {
  const [currentCode, setCurrentCode] = useState(code);
  const { execute, result, isExecuting, error } = useCodeExec();
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium text-roadmap-fill">
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

      <div className="flex flex-1 flex-col overflow-y-auto bg-[#1e1e2e]">
        <div className="min-h-[120px] p-3">
          <CodeEditor
            key={code}
            language={language}
            value={currentCode}
            onChange={handleCodeChange}
          />
        </div>

        <div className="mx-3 border-t border-white/8" />

        <TerminalPanel result={result} error={error} isExecuting={isExecuting} />
      </div>
    </div>
  );
}
