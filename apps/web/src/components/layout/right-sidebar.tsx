"use client";

import { RoadmapNode } from "@/components/roadmap/roadmap-node";
import { CodePanel } from "@/components/sidebar/code-panel";
import { MapPin, Code2 } from "lucide-react";
import { useState, useEffect } from "react";

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

type Tab = "roadmap" | "code";

export function RightSidebar({ nodes, codePanel, onCodePanelChange }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("roadmap");

  const mastered = nodes.filter((n) => n.status === "mastered").length;
  const total = nodes.length;
  const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;

  useEffect(() => {
    if (codePanel) {
      setActiveTab("code");
    }
  }, [codePanel]);

  return (
    <div className="flex h-full w-[296px] flex-col border-l border-border bg-card">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("roadmap")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === "roadmap"
              ? "border-b-2 border-roadmap-fill text-roadmap-fill"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          路线图
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("code")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === "code"
              ? "border-b-2 border-roadmap-fill text-roadmap-fill"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          代码编辑器
        </button>
      </div>

      {activeTab === "roadmap" && (
        <>
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
                  <span className="text-[11px] font-medium text-roadmap-fill">{progress}%</span>
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
        </>
      )}

      {activeTab === "code" && (
        codePanel ? (
          <CodePanel
            code={codePanel.code}
            language={codePanel.language}
            instruction={codePanel.instruction}
            onCodeChange={onCodePanelChange ?? (() => {})}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Code2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              AI 助手会在教学过程中推送代码到这里
            </p>
          </div>
        )
      )}
    </div>
  );
}
