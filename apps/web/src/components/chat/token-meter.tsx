import { ChevronDown } from "lucide-react";
import type {
  AgentActivity,
  ContextInfo,
  TokenUsage,
} from "@/hooks/use-chat-stream";
import { getCurrentContextTokens } from "@/lib/usage-metrics";

interface TokenMeterProps {
  usage: TokenUsage;
  contextInfo: ContextInfo | null;
  activity: AgentActivity;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return String(value);
}

function formatActivityName(name: string): string {
  if (!name.toLowerCase().startsWith("mcp__")) return name;
  return name.slice(5).split("__").join(" / ");
}

export function TokenMeter({
  usage,
  contextInfo,
  activity,
}: TokenMeterProps) {
  const contextWindow = usage.contextWindow;
  const currentContextTokens = getCurrentContextTokens(usage);
  const usedPercent = contextWindow
    ? Math.min(100, Math.round((currentContextTokens / contextWindow) * 100))
    : null;
  const remainingPercent =
    usedPercent === null ? null : Math.max(0, 100 - usedPercent);
  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const usedArc =
    usedPercent === null ? 0 : (usedPercent / 100) * circumference;
  const hasActivity = activity.toolCalls > 0 || activity.mcpCalls > 0;

  return (
    <details
      open
      className="group rounded-xl bg-card text-xs text-muted-foreground"
      data-testid="token-usage-meter"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-t-xl px-3 py-2 outline-none transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <svg
            width="34"
            height="34"
            viewBox="0 0 34 34"
            aria-hidden="true"
            className="shrink-0 -rotate-90"
          >
            <circle
              cx="17"
              cy="17"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-border"
            />
            {usedPercent !== null && (
              <circle
                cx="17"
                cy="17"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${usedArc} ${circumference}`}
                strokeLinecap="round"
                className="text-primary"
              />
            )}
          </svg>

          <div className="min-w-0 leading-tight">
            <div className="font-medium text-foreground">
              {remainingPercent === null
                ? "上下文上限未知"
                : `${remainingPercent}% 上下文可用`}
            </div>
            <div className="mt-1 truncate tabular-nums">
              {formatTokens(currentContextTokens)}
              {contextWindow ? ` / ${formatTokens(contextWindow)}` : " 已用"}
              {usage.modelId ? ` · ${usage.modelId}` : ""}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasActivity && (
            <span className="hidden tabular-nums sm:inline">
              {activity.toolCalls > 0 && `工具 ${activity.toolCalls}`}
              {activity.toolCalls > 0 && activity.mcpCalls > 0 && " · "}
              {activity.mcpCalls > 0 && `MCP ${activity.mcpCalls}`}
            </span>
          )}
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
          <span className="sr-only">收起用量详情</span>
        </div>
      </summary>

      <div className="border-t border-border/60 px-3 pb-3 pt-2.5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
          <Metric label="本轮输入" value={formatTokens(usage.input)} />
          <Metric label="本轮输出" value={formatTokens(usage.output)} />
          <Metric
            label="思考"
            value={usage.reasoning > 0 ? formatTokens(usage.reasoning) : "—"}
          />
          <Metric label="会话累计" value={formatTokens(usage.sessionTotal)} />
        </div>

        {(usage.cacheRead > 0 || usage.cacheWrite > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/50 pt-2 text-[11px]">
            {usage.cacheRead > 0 && (
              <span>缓存命中 {formatTokens(usage.cacheRead)}</span>
            )}
            {usage.cacheWrite > 0 && (
              <span>缓存写入 {formatTokens(usage.cacheWrite)}</span>
            )}
          </div>
        )}

        {hasActivity && (
          <div className="mt-2.5 border-t border-border/50 pt-2">
            <div className="mb-1.5 text-[11px] font-medium text-foreground/70">
              Agent 活动
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activity.items.map((item) => (
                <span
                  key={`${item.source}:${item.name}`}
                  className="rounded-md bg-secondary/70 px-2 py-1 font-mono text-[10px] text-foreground/70"
                >
                  {item.source === "mcp" ? "MCP · " : ""}
                  {formatActivityName(item.name)}
                  {item.count > 1 ? ` ×${item.count}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {contextInfo?.needsCompaction && (
          <p className="mt-2.5 border-t border-border/50 pt-2 text-[11px] text-amber-700">
            历史消息已达到内部压缩阈值：约{" "}
            {formatTokens(contextInfo.estimatedHistoryTokens)} /{" "}
            {formatTokens(contextInfo.compactionBudget)}
          </p>
        )}
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground/80">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums text-foreground/80">
        {value}
      </div>
    </div>
  );
}
