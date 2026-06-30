import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface OrderingProps {
  label: string;
  items: Array<{ id: string; text: string }>;
  disabled?: boolean;
}

export function OrderingExplore({ label, items, disabled }: OrderingProps) {
  const [ordered, setOrdered] = useState(items);
  function move(i: number, dir: -1 | 1) {
    if (disabled) return;
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    setOrdered((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-1.5">
        {ordered.map((it, i) => (
          <div
            key={it.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            <span className="text-xs text-muted-foreground">{i + 1}.</span>
            <span className="flex-1">{it.text}</span>
            {!disabled && (
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="size-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === ordered.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
