"use client";

import { Trophy } from "lucide-react";
import type { MasteryReportBlock as MasteryReportBlockType } from "@ai-teacher/shared";

interface MasteryReportBlockProps {
  block: MasteryReportBlockType;
}

function scoreColor(score: number) {
  if (score >= 90) return "text-roadmap-mastered";
  if (score >= 80) return "text-accent";
  return "text-destructive";
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MasteryReportBlock({ block }: MasteryReportBlockProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <Trophy className="h-5 w-5 text-roadmap-fill" />
        <h3 className="text-base font-semibold text-foreground flex-1">
          {block.nodeName}总结报告
        </h3>
        <span className={`text-2xl font-bold tabular-nums ${scoreColor(block.score)}`}>
          {block.score}
          <span className="text-sm font-normal text-muted-foreground">分</span>
        </span>
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">
        {renderInlineCode(block.summary)}
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-roadmap-fill/10">
              {block.table.columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-semibold text-chat-accent"
                >
                  {renderInlineCode(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, ri) => (
              <tr
                key={ri}
                className={ri % 2 === 0 ? "bg-transparent" : "bg-muted/30"}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-foreground border-t border-border/50">
                    {renderInlineCode(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {block.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {block.badges.map((badge, i) => (
            <span
              key={i}
              className="rounded-full px-3 py-1 text-xs font-medium bg-roadmap-mastered/10 text-roadmap-mastered"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
