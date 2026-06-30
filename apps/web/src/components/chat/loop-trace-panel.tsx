import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Wrench,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { LoopTrace } from "@/hooks/use-chat-stream";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function LoopTracePanel({ trace }: { trace: LoopTrace }) {
  const [expanded, setExpanded] = useState(false);

  const completedSteps = trace.steps.filter((s) => s.durationMs !== undefined);
  const totalMs = completedSteps.reduce(
    (sum, s) => sum + (s.durationMs ?? 0),
    0,
  );
  const stepCount = trace.steps.length;
  const failoverCount = trace.failovers?.length ?? 0;
  const warningCount = trace.loopWarnings?.length ?? 0;

  if (stepCount === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card/50 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Brain className="h-3.5 w-3.5 shrink-0 text-chat-thinking" />
        <span className="font-medium text-foreground">思考过程</span>
        <span className="text-xs text-muted-foreground">
          {stepCount} 步
          {completedSteps.length === stepCount && totalMs > 0
            ? ` · 用时 ${formatDuration(totalMs)}`
            : completedSteps.length > 0
              ? ` · 已用时 ${formatDuration(totalMs)}`
              : ""}
        </span>
        {failoverCount > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600">
            <RefreshCw className="h-3 w-3" />
            降级 {failoverCount}
          </span>
        )}
        {warningCount > 0 && (
          <span
            className={`flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-600 ${
              failoverCount > 0 ? "" : "ml-auto"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            警告 {warningCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {trace.steps.map((s) => (
            <div key={s.step} className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">
                  步骤 {s.step}
                  {s.total > 0 ? `/${s.total}` : ""}
                </span>
                {s.durationMs !== undefined ? (
                  <span className="text-muted-foreground">
                    {formatDuration(s.durationMs)}
                  </span>
                ) : (
                  <span className="text-chat-thinking">进行中…</span>
                )}
                {s.tools && s.tools.length > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    {s.tools.map((t) => t.name).join(", ")}
                  </span>
                )}
              </div>
              {s.reasoning && s.reasoning.trim() && (
                <p className="whitespace-pre-wrap pl-4 text-xs leading-relaxed text-muted-foreground">
                  {s.reasoning.trim()}
                </p>
              )}
            </div>
          ))}

          {trace.failovers && trace.failovers.length > 0 && (
            <div className="space-y-1.5 rounded-md bg-amber-500/5 p-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <RefreshCw className="h-3 w-3" />
                降级轨迹
              </div>
              {trace.failovers.map((f, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    步骤 {f.step}：
                  </span>
                  {f.from} → {f.to}
                  {f.reason ? `（${f.reason}）` : ""}
                </p>
              ))}
            </div>
          )}

          {trace.loopWarnings && trace.loopWarnings.length > 0 && (
            <div className="space-y-1.5 rounded-md bg-orange-500/5 p-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700">
                <AlertTriangle className="h-3 w-3" />
                循环警告
              </div>
              {trace.loopWarnings.map((w, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    步骤 {w.step}：
                  </span>
                  {w.toolName || w.type || "工具调用"}（{w.type || "loop"}）
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
