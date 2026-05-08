"use client";

interface RoadmapNodeProps {
  title: string;
  status: "mastered" | "in-progress" | "not-started";
  masteryScore: number;
}

export function RoadmapNode({ title, status, masteryScore }: RoadmapNodeProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        status === "in-progress"
          ? "border-l-2 border-blue-500 bg-blue-50 font-medium text-blue-700"
          : status === "mastered"
            ? "text-green-600"
            : "text-gray-400"
      }`}
    >
      <span className="shrink-0">
        {status === "mastered" && "✓"}
        {status === "in-progress" && "●"}
        {status === "not-started" && "○"}
      </span>
      <span className="truncate">{title}</span>
      {status === "in-progress" && masteryScore > 0 && (
        <span className="ml-auto text-xs text-blue-400">{masteryScore}%</span>
      )}
    </div>
  );
}
