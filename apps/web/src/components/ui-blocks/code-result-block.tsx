"use client";

import type { CodeResultBlock as CodeResultBlockType } from "@ai-teacher/shared";
import { CodeBlock } from "@/components/chat/code-block";

interface CodeResultBlockProps {
  block: CodeResultBlockType;
}

export function CodeResultBlock({ block }: CodeResultBlockProps) {
  const exitOk = block.exitCode === 0;

  return (
    <div className="space-y-2">
      <CodeBlock language={block.language}>{block.code}</CodeBlock>

      <div className="rounded-lg border border-code-border bg-code-bg p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-code-lang">输出</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              exitOk
                ? "bg-roadmap-mastered/10 text-roadmap-mastered"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            exit {block.exitCode}
          </span>
        </div>
        {block.stdout && (
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-code-text font-mono">
            {block.stdout}
          </pre>
        )}
        {block.stderr && (
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-destructive font-mono">
            {block.stderr}
          </pre>
        )}
      </div>
    </div>
  );
}
