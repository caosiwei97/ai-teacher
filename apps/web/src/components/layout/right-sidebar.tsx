"use client";

import { RoadmapNode } from "@/components/roadmap/roadmap-node";
import { MapPin } from "lucide-react";

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
}

export function RightSidebar({ nodes }: RightSidebarProps) {
  const mastered = nodes.filter((n) => n.status === "mastered").length;
  const total = nodes.length;
  const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <div className="flex h-full w-[296px] flex-col border-l border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-roadmap-fill" />
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
    </div>
  );
}
