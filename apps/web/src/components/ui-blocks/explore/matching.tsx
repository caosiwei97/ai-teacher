import { useState } from "react";

interface MatchingProps {
  label: string;
  leftItems: Array<{ id: string; text: string }>;
  rightItems: Array<{ id: string; text: string }>;
  disabled?: boolean;
}

export function MatchingExplore({ label, leftItems, rightItems, disabled }: MatchingProps) {
  // pairs: leftId -> rightId
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [activeLeft, setActiveLeft] = useState<string | null>(null);

  function clickLeft(id: string) {
    if (disabled) return;
    setActiveLeft((prev) => (prev === id ? null : id));
  }
  function clickRight(id: string) {
    if (disabled || !activeLeft) return;
    setPairs((prev) => {
      const next = { ...prev };
      // 移除该 right 已有的配对
      for (const k of Object.keys(next)) if (next[k] === id) delete next[k];
      next[activeLeft] = id;
      return next;
    });
    setActiveLeft(null);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {leftItems.map((l) => {
            const paired = pairs[l.id];
            const isActive = activeLeft === l.id;
            return (
              <button
                key={l.id}
                type="button"
                disabled={disabled}
                onClick={() => clickLeft(l.id)}
                className={`w-full rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : paired
                      ? "border-roadmap-fill/50 bg-roadmap-fill/10"
                      : "border-border bg-card hover:bg-secondary"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {l.text}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rightItems.map((r) => {
            const paired = Object.values(pairs).includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                disabled={disabled || !activeLeft}
                onClick={() => clickRight(r.id)}
                className={`w-full rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                  paired
                    ? "border-roadmap-fill/50 bg-roadmap-fill/10"
                    : "border-border bg-card hover:bg-secondary"
                } ${disabled || !activeLeft ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {r.text}
              </button>
            );
          })}
        </div>
      </div>
      {activeLeft && <p className="text-xs text-muted-foreground">点击右侧项完成配对</p>}
    </div>
  );
}
