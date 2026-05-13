"use client";

import { RoadmapNode } from "@/components/roadmap/roadmap-node";
import { CodePanel } from "@/components/sidebar/code-panel";
import { MapPin, Code2 } from "lucide-react";

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
  activeTab: "roadmap" | "code";
  onTabChange: (tab: "roadmap" | "code") => void;
  llmConfigId?: string;
}

export function RightSidebar({
  nodes,
  codePanel,
  onCodePanelChange,
  activeTab,
  onTabChange,
  llmConfigId,
}: RightSidebarProps) {
  const hasCode = !!codePanel;

  const mastered = nodes.filter((n) => n.status === "mastered").length;
  const total = nodes.length;
  const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <div className="flex h-full w-full flex-col bg-sidebar">
      {/* Tab bar — only show when both roadmap and code exist */}
      {hasCode && (
        <div className="flex shrink-0 border-b border-border px-4 py-0">
          <button
            onClick={() => onTabChange("code")}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "code"
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            代码
          </button>
          <button
            onClick={() => onTabChange("roadmap")}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "roadmap"
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            学习路线
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "roadmap" && (
          <>
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    学习路线
                  </h2>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {mastered}/{total}
                </span>
              </div>
              {total > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      总进度
                    </span>
                    <span className="text-[11px] font-medium text-sidebar-accent">
                      {progress}%
                    </span>
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
                  status={
                    node.status as
                      | "mastered"
                      | "in-progress"
                      | "not-started"
                  }
                  masteryScore={node.masteryScore}
                  isLast={i === nodes.length - 1}
                />
              ))}
            </div>
          </>
        )}

        {activeTab === "code" && hasCode && (
          <CodePanel
            code={codePanel!.code}
            language={codePanel!.language}
            instruction={codePanel!.instruction}
            onCodeChange={onCodePanelChange ?? (() => {})}
            llmConfigId={llmConfigId}
          />
        )}
      </div>
    </div>
  );
}
