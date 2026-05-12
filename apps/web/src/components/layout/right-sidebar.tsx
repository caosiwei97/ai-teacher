"use client";

import { RoadmapNode } from "@/components/roadmap/roadmap-node";
import { CodePanel } from "@/components/sidebar/code-panel";
import { ResizableDivider } from "@/components/layout/resizable-divider";
import { MapPin, Code2 } from "lucide-react";
import { useState, useCallback } from "react";

interface Node {
  id: string;
  index: number;
  title: string;
  description: string;
  status: string;
  masteryScore: number;
}

interface RightSidebarProps {
  nodes: Node[];
  codePanel?: {
    code: string;
    language: string;
    instruction?: string;
  } | null;
  onCodePanelChange?: (code: string) => void;
}

const ROADMAP_MIN_HEIGHT = 150;
const CODE_MIN_HEIGHT = 200;

export function RightSidebar({ nodes, codePanel, onCodePanelChange }: RightSidebarProps) {
  const hasCode = !!codePanel;
  const [splitRatio, setSplitRatio] = useState(0.4);
  const [containerHeight, setContainerHeight] = useState(0);

  const mastered = nodes.filter((n) => n.status === "mastered").length;
  const total = nodes.length;
  const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const handleVerticalResize = useCallback(
    (delta: number) => {
      if (containerHeight <= 0) return;
      setSplitRatio((prev) => {
        const next = prev + delta / containerHeight;
        const minRatio = ROADMAP_MIN_HEIGHT / containerHeight;
        const maxRatio = 1 - CODE_MIN_HEIGHT / containerHeight;
        return Math.max(minRatio, Math.min(maxRatio, next));
      });
    },
    [containerHeight],
  );

  const handleContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
  }, []);

  const roadmapHeightPercent = containerHeight > 0 ? Math.round(splitRatio * 100) : 40;

  return (
    <div
      ref={handleContainerRef}
      className="flex h-full shrink-0 flex-col border-l border-border bg-sidebar"
    >
      {/* Roadmap section */}
      <div
        className="flex shrink-0 flex-col overflow-hidden"
        style={{ height: hasCode ? `${roadmapHeightPercent}%` : "100%" }}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">学习路线</h2>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {mastered}/{total}
            </span>
          </div>
          {total > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">总进度</span>
                <span className="text-[11px] font-medium text-sidebar-accent">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-roadmap-track">
                <div
                  className="h-1.5 rounded-full bg-roadmap-fill transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {nodes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                诊断完成后将生成学习路线
              </p>
            </div>
          )}
          {nodes.map((node, i) => (
            <RoadmapNode
              key={node.id}
              index={i + 1}
              title={node.title}
              status={node.status as "mastered" | "in-progress" | "not-started"}
              masteryScore={node.masteryScore}
              isLast={i === nodes.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Vertical divider + code panel */}
      {hasCode && (
        <>
          <ResizableDivider direction="vertical" onResize={handleVerticalResize} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CodePanel
              code={codePanel!.code}
              language={codePanel!.language}
              instruction={codePanel!.instruction}
              onCodeChange={onCodePanelChange ?? (() => {})}
            />
          </div>
        </>
      )}

      {/* Empty code hint (shown when no code but sidebar visible) */}
      {!hasCode && (
        <div className="hidden items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sidebar-hover">
            <Code2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            AI 助手会在教学过程中推送代码到这里
          </p>
        </div>
      )}
    </div>
  );
}
