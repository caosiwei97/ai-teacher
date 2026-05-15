
import { cn } from "@/lib/utils";
import { getColorClasses, type ProviderColor } from "@/lib/llm-presets";

interface ProviderCardProps {
  name: string;
  color: ProviderColor;
  selected?: boolean;
  onClick: () => void;
}

export function ProviderCard({ name, color, selected, onClick }: ProviderCardProps) {
  const colors = getColorClasses(color);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150",
        selected
          ? "border-primary bg-primary/8 shadow-[0_0_0_1px_var(--color-primary)]"
          : "border-border bg-card hover:border-border-strong hover:bg-secondary",
      )}
    >
      <span className={cn("h-3 w-3 shrink-0 rounded-full", colors.dot)} />
      <span className={cn("text-sm font-medium", selected ? "text-foreground" : "text-muted-foreground")}>
        {name}
      </span>
    </button>
  );
}
