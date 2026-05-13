"use client";

import { useState, useCallback } from "react";
import { CodeEditor } from "@/components/editor/code-editor";
import { useCodeExec } from "@/hooks/use-code-exec";
import { Play, Loader2, Trash2, Copy, Check } from "lucide-react";

interface CodePanelProps {
  code: string;
  language: string;
  instruction?: string;
  onCodeChange: (code: string) => void;
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

export function CodePanel({ code, language, instruction, onCodeChange }: CodePanelProps) {
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
    await execute(currentCode, langId);
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

      <div className="flex-1 overflow-y-auto p-3">
        <CodeEditor
          key={code}
          language={language}
          value={currentCode}
          onChange={handleCodeChange}
        />
      </div>

      {(result || error) && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Output</span>
            {result?.time && (
              <span className="text-[10px] text-muted-foreground/60">{result.time}s</span>
            )}
          </div>
          <div className="rounded-lg bg-[#1e1e2e] p-3">
            {error && (
              <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">{error}</pre>
            )}
            {result && (
              <>
                {result.stdout && (
                  <pre className="whitespace-pre-wrap font-mono text-xs text-green-400">
                    {result.stdout}
                  </pre>
                )}
                {result.stderr && (
                  <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
                    {result.stderr}
                  </pre>
                )}
                {!result.stdout && !result.stderr && (
                  <p className="font-mono text-xs text-muted-foreground">（无输出）</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
