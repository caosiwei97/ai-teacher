import { useState } from "react";

interface FillBlankProps {
  label: string;
  template: string; // 含 {{1}} {{2}} 占位符
  disabled?: boolean;
}

export function FillBlankExplore({ label, template, disabled }: FillBlankProps) {
  // 按 {{数字}} 拆分 template
  const parts = template.split(/(\{\{\d+\}\})/g);
  const blanks = parts.filter((p) => /\{\{\d+\}\}/.test(p));
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="rounded-lg border border-border bg-card p-3 text-sm leading-relaxed text-foreground">
        {parts.map((p, i) => {
          const match = p.match(/\{\{(\d+)\}\}/);
          if (match) {
            const key = match[1];
            return (
              <input
                key={i}
                type="text"
                value={values[key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                readOnly={disabled}
                className="mx-1 inline-block w-20 rounded border border-input-border bg-input px-2 py-0.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-roadmap-fill focus:outline-none"
                placeholder="____"
              />
            );
          }
          return <span key={i}>{p}</span>;
        })}
      </div>
      <p className="text-xs text-muted-foreground">共 {blanks.length} 处填空</p>
    </div>
  );
}
