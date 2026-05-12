"use client";

import type { TableBlock as TableBlockType } from "@ai-teacher/shared";

interface TableBlockProps {
  block: TableBlockType;
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

export function TableBlock({ block }: TableBlockProps) {
  return (
    <div className="space-y-2">
      {block.title && (
        <h4 className="text-sm font-semibold text-roadmap-fill whitespace-nowrap overflow-x-auto">
          {renderInlineCode(block.title)}
        </h4>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-roadmap-fill/10">
              {block.headers.map((header, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-semibold text-chat-accent"
                >
                  {renderInlineCode(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
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
    </div>
  );
}
