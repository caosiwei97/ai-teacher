import { useState } from "react";

interface ChoiceProps {
  label: string;
  options: Array<{ id: string; text: string }>;
  allowMultiple: boolean;
  disabled?: boolean;
}

export function ChoiceExplore({ label, options, allowMultiple, disabled }: ChoiceProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    if (disabled) return;
    setSelected((prev) => {
      if (allowMultiple) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(o.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              selected.has(o.id)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-secondary"
            } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}
