import { Lock } from "lucide-react";

export type ActiveMode = "learning" | "review" | "interview";

interface ModeTab {
  value: ActiveMode;
  icon: string;
  label: string;
  colorVar: string;
}

// 三模式顶部 Tab（spec §5.1）：学习靛蓝 / 复习黄 / 面试红（spec §5.5）
const MODE_TABS: ModeTab[] = [
  { value: "learning", icon: "🌱", label: "学习", colorVar: "var(--color-primary)" },
  { value: "review", icon: "🔁", label: "复习", colorVar: "var(--color-review)" },
  { value: "interview", icon: "🔥", label: "面试", colorVar: "var(--color-interview)" },
];

interface ModeTabsProps {
  activeMode: ActiveMode;
  masteredCount: number;
  onChange: (mode: ActiveMode) => void;
}

export function ModeTabs({ activeMode, masteredCount, onChange }: ModeTabsProps) {
  // 渐进解锁（spec §5.2）：0 知识点时复习/面试灰锁
  const unlocked = masteredCount > 0;

  return (
    <div data-testid="mode-tabs" className="flex shrink-0 items-center gap-1 border-b border-border bg-card/50 px-3 py-1.5">
      {MODE_TABS.map((tab) => {
        const isActive = activeMode === tab.value;
        const isLocked = !unlocked && tab.value !== "learning";
        return (
          <button
            key={tab.value}
            type="button"
            disabled={isLocked}
            onClick={() => onChange(tab.value)}
            title={isLocked ? "先学完一个知识点再解锁" : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? ""
                : isLocked
                  ? "cursor-not-allowed text-muted-foreground/40"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            style={
              isActive
                ? {
                    background: `color-mix(in srgb, ${tab.colorVar} 18%, transparent)`,
                    color: tab.colorVar,
                  }
                : undefined
            }
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {isLocked && <Lock className="h-3 w-3" />}
          </button>
        );
      })}
      <span className="ml-auto pr-1 text-[11px] text-muted-foreground">
        已掌握 {masteredCount}
      </span>
    </div>
  );
}
