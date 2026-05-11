"use client";

import { Award } from "lucide-react";

export interface AssessmentCardProps {
  summary: string;
  reviewTable: Array<{
    points: string;
    yourAnswer: string;
    accuracy: string;
  }>;
  coreTags: string[];
  nextNodeTitle: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReviewRow(
  value: unknown,
): value is AssessmentCardProps["reviewTable"][number] {
  return (
    isObject(value) &&
    typeof value.points === "string" &&
    typeof value.yourAnswer === "string" &&
    typeof value.accuracy === "string"
  );
}

export function isAssessmentCardData(value: unknown): value is AssessmentCardProps {
  return (
    isObject(value) &&
    typeof value.summary === "string" &&
    Array.isArray(value.reviewTable) &&
    value.reviewTable.every(isReviewRow) &&
    Array.isArray(value.coreTags) &&
    value.coreTags.every((tag) => typeof tag === "string") &&
    typeof value.nextNodeTitle === "string"
  );
}

function getAccuracyClass(accuracy: string) {
  if (accuracy.includes("部分") || accuracy.includes("中")) {
    return "text-primary";
  }

  if (
    accuracy.includes("低") ||
    accuracy.includes("错") ||
    accuracy.includes("需要加强") ||
    accuracy.includes("待改进")
  ) {
    return "text-destructive";
  }

  if (
    accuracy.includes("高") ||
    accuracy.includes("完全") ||
    accuracy.includes("正确") ||
    accuracy.includes("掌握")
  ) {
    return "text-roadmap-mastered";
  }

  return "text-muted-foreground";
}

export function AssessmentCard({
  summary,
  reviewTable,
  coreTags,
}: AssessmentCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Award className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">
            学习评估
          </p>
          <p className="mt-1 text-sm leading-6 text-foreground">{summary}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">回顾表</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            看看这一节你已经掌握了哪些关键点。
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-secondary text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">要点</th>
                  <th className="px-4 py-3 font-medium">你的回答</th>
                  <th className="px-4 py-3 font-medium">准确度</th>
                </tr>
              </thead>
              <tbody>
                {reviewTable.map((row, index) => (
                  <tr key={`${row.points}-${index}`} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-medium text-foreground">{row.points}</td>
                    <td className="whitespace-pre-wrap px-4 py-3 text-muted-foreground">
                      {row.yourAnswer}
                    </td>
                    <td className={`px-4 py-3 font-medium ${getAccuracyClass(row.accuracy)}`}>
                      {row.accuracy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-medium text-foreground">核心标签</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {coreTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
