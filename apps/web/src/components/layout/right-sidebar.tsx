"use client";

import { RoadmapNode } from "@/components/roadmap/roadmap-node";

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

  return (
    <div className="flex h-full w-[300px] flex-col border-l border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">路线图</h2>
          <span className="text-sm text-gray-500">
            {mastered}/{total}
          </span>
        </div>
        {total > 0 && (
          <div className="mt-2 h-1.5 rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${(mastered / total) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {nodes.map((node) => (
          <RoadmapNode
            key={node.id}
            title={node.title}
            status={node.status as "mastered" | "in-progress" | "not-started"}
            masteryScore={node.masteryScore}
          />
        ))}
      </div>
    </div>
  );
}
