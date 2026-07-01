import type { PromptContextBreakdown } from "@ai-teacher/shared";
import type { ContextInfo, TokenUsage } from "@/hooks/use-chat-stream";
import { getCacheHitRate } from "@/lib/usage-metrics";

interface TokenMeterProps {
  usage: TokenUsage;
  contextInfo: ContextInfo | null;
}

const BREAKDOWN_ROWS: Array<{
  key: keyof PromptContextBreakdown;
  label: string;
}> = [
  { key: "system", label: "系统消息" },
  { key: "user", label: "用户消息" },
  { key: "assistant", label: "AI 消息" },
  { key: "tools", label: "内置工具" },
  { key: "mcpTools", label: "MCP 工具" },
];

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return String(value);
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0%";
  const percent = (value / total) * 100;
  if (value > 0 && percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}

export function TokenMeter({ usage, contextInfo }: TokenMeterProps) {
  const contextPercent = usage.contextWindow
    ? Math.min(100, Math.round((usage.input / usage.contextWindow) * 100))
    : null;
  const cacheHitRate = getCacheHitRate(usage);
  const rows = usage.contextBreakdown
    ? BREAKDOWN_ROWS.filter(({ key }) => usage.contextBreakdown![key] > 0)
    : [];

  return (
    <div
      id="prompt-context-popover"
      role="dialog"
      aria-label="Prompt 上下文组成"
      className="w-64 rounded-xl bg-card px-3 py-3 text-xs text-muted-foreground"
      data-testid="token-usage-meter"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">Prompt 上下文</div>
          <div className="mt-1 text-[10px]">{usage.modelId ?? "当前模型"}</div>
        </div>
        <div className="text-right tabular-nums">
          <div className="font-medium text-foreground">
            {formatTokens(usage.input)}
            {usage.contextWindow
              ? ` / ${formatTokens(usage.contextWindow)}`
              : " 已用"}
          </div>
          <div className="mt-1 text-[10px]">
            {contextPercent === null ? "上限未知" : `已用 ${contextPercent}%`}
          </div>
        </div>
      </div>

      {usage.contextWindow && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(1, contextPercent ?? 0)}%` }}
          />
        </div>
      )}

      <div
        className="mt-3 space-y-2.5 border-t border-border/60 pt-2.5"
        data-testid="prompt-context-breakdown"
      >
        {rows.length > 0 ? (
          rows.map(({ key, label }) => {
            const value = usage.contextBreakdown![key];
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-4"
              >
                <span>{label}</span>
                <span className="tabular-nums text-foreground/80">
                  ≈{formatTokens(value)} · {formatPercent(value, usage.input)}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-[11px]">Prompt 组成将在下次回复后更新</p>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-4 border-t border-border/60 pt-2.5">
        <span>缓存命中率</span>
        <span className="tabular-nums text-foreground/80">
          {cacheHitRate === null
            ? "未提供"
            : `${cacheHitRate}% · ${formatTokens(usage.cacheRead)}`}
        </span>
      </div>

      {contextInfo?.needsCompaction && (
        <p className="mt-2.5 border-t border-border/60 pt-2.5 text-[10px] text-amber-700">
          历史消息已达到内部压缩阈值
        </p>
      )}

      <p className="mt-2.5 text-[9px] leading-4 text-muted-foreground/70">
        分类为估算值，总量来自模型实际输入
      </p>
    </div>
  );
}
