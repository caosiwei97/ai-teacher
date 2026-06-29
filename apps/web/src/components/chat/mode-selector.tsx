
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export type TeachingMode = "warm" | "strict";

interface ModeOption {
  value: TeachingMode;
  icon: string;
  label: string;
  description: string;
}

const modes: ModeOption[] = [
  { value: "warm", icon: "☕", label: "温暖私教", description: "慢慢来，不着急" },
  { value: "strict", icon: "🔥", label: "严格教练", description: "不接受'差不多就行'" },
];

interface ModeSelectorProps {
  value: TeachingMode;
  onChange: (mode: TeachingMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = modes.find((m) => m.value === value) ?? modes[0];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <span className="text-sm">{current.icon}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="p-2">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => { onChange(mode.value); setOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  value === mode.value
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <span className="text-lg">{mode.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                </div>
                {value === mode.value && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
