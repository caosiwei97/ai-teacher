
import type { FormulaBlock } from "@ai-teacher/shared";
import katex from "katex";
import "katex/dist/katex.min.css";

interface FormulaDisplayProps {
  block: FormulaBlock;
}

export function FormulaDisplay({ block }: FormulaDisplayProps) {
  const html = katex.renderToString(block.latex, { throwOnError: false });

  return (
    <div className="rounded-xl bg-card p-4">
      <div
        className="overflow-x-auto text-center text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {block.description && (
        <p className="mt-2 text-center text-sm text-muted-foreground">{block.description}</p>
      )}
    </div>
  );
}
