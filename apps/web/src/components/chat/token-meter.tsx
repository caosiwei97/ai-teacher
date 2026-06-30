import type { TokenUsage, ContextInfo } from "@/hooks/use-chat-stream";

interface TokenMeterProps {
  usage: TokenUsage;
  contextInfo: ContextInfo | null;
  estimatedSystemTools: number;
}

// 聊天框底部 token 仪表盘：双向圆（输入/输出对比）+ 真实用量明细 + 估算 + 上下文占比 + 会话累计
// provider 无关：统一读 LanguageModelUsage，字段为 0 时不展示该行
export function TokenMeter({ usage, contextInfo, estimatedSystemTools }: TokenMeterProps) {
  const max = Math.max(usage.input, usage.output, 1);
  const inputPct = Math.round((usage.input / max) * 100);
  const outputPct = Math.round((usage.output / max) * 100);
  const contextPct = contextInfo
    ? Math.round((contextInfo.tokenCount / contextInfo.budget) * 100)
    : 0;

  // 双向圆：左半 input（primary），右半 output（accent）
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const inputArc = (inputPct / 100) * (circumference / 2);
  const outputArc = (outputPct / 100) * (circumference / 2);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeWidth="3" opacity="0.15" />
        {/* 左半 input */}
        <circle
          cx="22" cy="22" r={radius} fill="none"
          stroke="var(--color-primary, currentColor)" strokeWidth="3"
          strokeDasharray={`${inputArc} ${circumference}`}
          strokeDashoffset={circumference / 4}
          transform="rotate(-90 22 22)"
          strokeLinecap="round"
        />
        {/* 右半 output */}
        <circle
          cx="22" cy="22" r={radius} fill="none"
          stroke="var(--color-accent, currentColor)" strokeWidth="3"
          strokeDasharray={`${outputArc} ${circumference}`}
          strokeDashoffset={-(circumference / 4)}
          transform="rotate(-90 22 22)"
          strokeLinecap="round"
        />
      </svg>
      <div className="space-y-0.5">
        <div className="flex gap-3">
          <span>输入 {usage.input || "-"}</span>
          <span>输出 {usage.output || "-"}</span>
        </div>
        <div>本会话累计 {usage.sessionTotal} tokens</div>
        {usage.cacheRead > 0 && <div>缓存命中 {usage.cacheRead}</div>}
        {usage.cacheWrite > 0 && <div>缓存写入 {usage.cacheWrite}</div>}
        {usage.reasoning > 0 && <div>思考 {usage.reasoning}</div>}
        {estimatedSystemTools > 0 && (
          <div className="text-foreground/50">估算 system+tools ≈{estimatedSystemTools}</div>
        )}
        {contextInfo && (
          <div className={contextInfo.needsCompaction ? "text-destructive" : ""}>
            上下文 {contextInfo.tokenCount}/{contextInfo.budget}（{contextPct}%）
          </div>
        )}
      </div>
    </div>
  );
}
