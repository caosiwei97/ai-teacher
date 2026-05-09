"use client";

import { useState } from "react";
import type { CodeResultBlock as CodeResultBlockType } from "@ai-teacher/shared";
import { CodeBlock } from "@/components/chat/code-block";
import { useCodeExec } from "@/hooks/use-code-exec";

const LANGUAGE_TO_ID: Record<string, number> = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  c: 50,
  typescript: 74,
  go: 60,
  rust: 73,
  ruby: 72,
  php: 68,
};

interface CodeResultBlockProps {
  block: CodeResultBlockType;
  onResult?: (result: {
    stdout: string;
    stderr: string;
    exitCode: number;
  }) => void;
}

export function CodeResultBlock({ block, onResult }: CodeResultBlockProps) {
  const [editing, setEditing] = useState(false);
  const [editCode, setEditCode] = useState(block.code);
  const { execute, isExecuting } = useCodeExec();

  // 用最新结果覆盖初始 block 数据
  const [liveResult, setLiveResult] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
  } | null>(null);

  const stdout = liveResult?.stdout ?? block.stdout;
  const stderr = liveResult?.stderr ?? block.stderr;
  const exitCode = liveResult?.exitCode ?? block.exitCode;
  const exitOk = exitCode === 0;

  const handleRun = async () => {
    const languageId = LANGUAGE_TO_ID[block.language];
    if (!languageId) return;

    const result = await execute(editCode, languageId);
    if (result) {
      setLiveResult(result);
      onResult?.(result);
    }
  };

  return (
    <div className="space-y-2">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            className="w-full min-h-[120px] rounded-lg border border-code-border bg-code-bg p-3 font-mono text-[13px] leading-relaxed text-code-text focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={isExecuting}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  运行中…
                </>
              ) : (
                "▶ 运行"
              )}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditCode(block.code);
              }}
              className="rounded-md border border-chat-border px-3 py-1.5 text-xs font-medium text-chat-muted hover:bg-chat-hover"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <CodeBlock language={block.language}>{block.code}</CodeBlock>
      )}

      <div className="rounded-lg border border-code-border bg-code-bg p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-code-lang">输出</span>
          <div className="flex items-center gap-2">
            {liveResult && (
              <span className="text-[11px] text-chat-muted">
                {"time" in liveResult && liveResult.time ? `${liveResult.time}s` : "—"}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                exitOk
                  ? "bg-roadmap-mastered/10 text-roadmap-mastered"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              exit {exitCode}
            </span>
          </div>
        </div>
        {stdout && (
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-code-text font-mono">
            {stdout}
          </pre>
        )}
        {stderr && (
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-destructive font-mono">
            {stderr}
          </pre>
        )}
      </div>

      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] font-medium text-chat-muted hover:text-amber-500 transition-colors"
        >
          ✎ 编辑并重新运行
        </button>
      )}
    </div>
  );
}
