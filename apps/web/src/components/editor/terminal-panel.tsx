"use client";

import { useRef, useEffect, useState } from "react";
import { Loader2, Terminal, Trash2, AlertTriangle, CircleCheck, CircleX } from "lucide-react";

interface TerminalPanelProps {
  result: {
    stdout: string;
    stderr: string;
    exitCode: number;
    time?: string;
    memory?: number;
    status?: string;
  } | null;
  error: string | null;
  isExecuting: boolean;
}

export function TerminalPanel({ result, error, isExecuting }: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [manuallyCleared, setManuallyCleared] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [result, error, isExecuting]);

  useEffect(() => {
    if (isExecuting) {
      setManuallyCleared(false);
    }
  }, [isExecuting]);

  function handleClear() {
    setManuallyCleared(true);
  }

  const isSandboxError = result?.status === "Sandbox Error";
  const hasContent = (result || error) && !manuallyCleared;
  const showPlaceholder = !hasContent && !isExecuting;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[11px] font-medium text-muted-foreground/80">终端</span>
          {isExecuting && (
            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
          )}
          {hasContent && result && !isExecuting && (
            result.exitCode === 0 ? (
              <CircleCheck className="h-3 w-3 text-green-500" />
            ) : (
              <CircleX className="h-3 w-3 text-red-500" />
            )
          )}
        </div>
        <div className="flex items-center gap-1">
          {result?.time && (
            <span className="mr-2 text-[10px] text-muted-foreground/40">{result.time}s</span>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-white/5 hover:text-muted-foreground/70"
            title="清空终端"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {isExecuting && !hasContent && (
          <div className="flex items-center gap-2 text-muted-foreground/50">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>正在执行...</span>
          </div>
        )}

        {showPlaceholder && (
          <p className="text-muted-foreground/30">点击 ▶ 运行代码...</p>
        )}

        {hasContent && (
          <>
            {isSandboxError && (
              <div className="mb-2 flex items-start gap-2 rounded bg-amber-500/10 px-2 py-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                <span className="text-amber-300">{result.stderr || "沙箱连接失败，请稍后重试"}</span>
              </div>
            )}

            {error && (
              <pre className="whitespace-pre-wrap text-red-400">{error}</pre>
            )}

            {result && result.stdout && (
              <pre className="whitespace-pre-wrap text-green-400">{result.stdout}</pre>
            )}

            {result && result.stderr && !isSandboxError && (
              <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>
            )}

            {result && !result.stdout && !result.stderr && !error && (
              <p className="text-muted-foreground/40">（无输出）</p>
            )}

            {result && (
              <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2">
                <span className="text-[10px] text-muted-foreground/40">退出码</span>
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    result.exitCode === 0
                      ? "bg-green-500/15 text-green-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {result.exitCode}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
