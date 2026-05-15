
import type { DiagramBlock } from "@ai-teacher/shared";
import { BarChart3 } from "lucide-react";

interface DiagramRendererProps {
  block: DiagramBlock;
}

export function DiagramRenderer({ block }: DiagramRendererProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-4 text-muted-foreground">
      <BarChart3 className="h-8 w-8" />
      <p className="text-sm">图表渲染 (即将支持)</p>
      <p className="text-xs">{block.diagramType}</p>
    </div>
  );
}
