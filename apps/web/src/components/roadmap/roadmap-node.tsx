
import { Check } from "lucide-react";

interface RoadmapNodeProps {
  index?: number;
  title: string;
  status: "mastered" | "in_progress" | "not_started";
  masteryScore: number;
  isLast?: boolean;
}

export function RoadmapNode({ title, status, masteryScore, isLast }: RoadmapNodeProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            status === "mastered"
              ? "border-roadmap-mastered bg-roadmap-mastered"
              : status === "in_progress"
                ? "border-roadmap-active bg-roadmap-active/10"
                : "border-roadmap-idle/40 bg-transparent"
          }`}
        >
          {status === "mastered" && <Check className="h-3 w-3 text-white" />}
          {status === "in_progress" && (
            <div className="h-2 w-2 rounded-full bg-roadmap-active" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 transition-colors ${
              status === "mastered" ? "bg-roadmap-mastered" : "bg-roadmap-track"
            }`}
          />
        )}
      </div>

      <div
        className={`flex-1 pb-4 pt-0.5 ${
          status === "in_progress" ? "-mt-px" : ""
        }`}
      >
        <div
          className={`rounded-lg px-3 py-2 transition-colors ${
            status === "in_progress"
              ? "bg-roadmap-active/8 ring-1 ring-roadmap-active/20"
              : ""
          }`}
        >
          <p
            className={`text-[13px] leading-snug ${
              status === "mastered"
                ? "font-medium text-roadmap-mastered"
                : status === "in_progress"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            {title}
          </p>
          {status === "in_progress" && masteryScore > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-roadmap-track">
                <div
                  className="h-1 rounded-full bg-roadmap-active transition-all duration-500"
                  style={{ width: `${masteryScore}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-roadmap-active">{masteryScore}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
