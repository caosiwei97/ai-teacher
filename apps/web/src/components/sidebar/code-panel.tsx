"use client";

import { useState } from "react";
import { CodeEditor } from "@/components/editor/code-editor";
import { useCodeExec } from "@/hooks/use-code-exec";
import { Play, Loader2, Trash2 } from "lucide-react";

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium text-roadmap-fill">
          {LANGUAGE_LABELS[language] ?? language}
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Trash2 className="h-3 w-3" />
          清空
        </button>
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

      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={isExecuting || !currentCode.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExecuting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          运行
        </button>

        {(result || error) && (
          <div className="mt-3 rounded-lg bg-[#1e1e2e] p-3">
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
        )}
      </div>
    </div>
  );
}
