import type { InterviewScoreBlock as InterviewScoreBlockType } from "@ai-teacher/shared";

interface InterviewScoreBlockProps {
  block: InterviewScoreBlockType;
}

const DIFFICULTY_LABEL: Record<InterviewScoreBlockType["difficulty"], string> = {
  easy: "🟢 初级",
  medium: "🟡 中级",
  hard: "🔴 高级",
};

// 面试评分卡/复盘（spec §4.1 复盘）：总评分 + 难度 + 薄弱点 + 改进建议。
export function InterviewScoreBlockRenderer({ block }: InterviewScoreBlockProps) {
  const score = block.totalScore;
  const scoreColor =
    score >= 80 ? "text-roadmap-fill" : score >= 60 ? "text-sidebar-accent" : "text-accent";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-border bg-accent/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-sm font-semibold text-foreground">面试评分卡</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          共 {block.questionCount} 题
        </span>
      </div>

      {/* 总评分 */}
      <div className="flex items-baseline justify-center gap-1 px-4 py-5">
        <span className={`text-4xl font-bold ${scoreColor}`}>{score}</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>

      {/* 难度 */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <span className="text-xs text-muted-foreground">最终难度</span>
        <span className="text-xs font-medium text-foreground">
          {DIFFICULTY_LABEL[block.difficulty]}
        </span>
      </div>

      {/* 薄弱点 */}
      {block.weakPoints.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            薄弱点
          </p>
          <div className="flex flex-wrap gap-1.5">
            {block.weakPoints.map((w, i) => (
              <span
                key={i}
                className="rounded-md bg-accent/10 px-2 py-0.5 text-xs text-foreground"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 改进建议 */}
      {block.improvement && (
        <div className="border-t border-border bg-roadmap-fill/5 px-4 py-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            改进建议
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">{block.improvement}</p>
        </div>
      )}
    </div>
  );
}
