
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";

const cycleOrder = ["dark", "light", "system"] as const;

const iconMap = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

const labelMap = {
  dark: "深色模式",
  light: "浅色模式",
  system: "跟随系统",
} as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const Icon = iconMap[theme];
  const label = labelMap[theme];

  const handleClick = () => {
    const idx = cycleOrder.indexOf(theme);
    let nextIdx = (idx + 1) % cycleOrder.length;
    let next = cycleOrder[nextIdx];

    const nextResolved =
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next;

    if (nextResolved === resolvedTheme) {
      nextIdx = (nextIdx + 1) % cycleOrder.length;
      next = cycleOrder[nextIdx];
    }

    setTheme(next);
  };

  return (
    <button
      onClick={handleClick}
      className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
