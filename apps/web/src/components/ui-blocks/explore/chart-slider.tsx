import { useState, useMemo } from "react";

interface ChartSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  chartType: "line" | "bar";
  formula?: string;
  disabled?: boolean;
}

// 预设公式映射（避免直接 eval）
const PRESET_FORMULAS: Record<string, (x: number) => number> = {
  "x*x": (x) => x * x,
  "x^2": (x) => x * x,
  "2*x": (x) => 2 * x,
  "x/2": (x) => x / 2,
  "sqrt(x)": (x) => Math.sqrt(Math.max(0, x)),
  "sin(x)": (x) => Math.sin(x),
};

export function ChartSliderExplore({ label, min, max, step, initial, chartType, formula, disabled }: ChartSliderProps) {
  const [val, setVal] = useState(initial);

  // 采样函数曲线数据
  const points = useMemo(() => {
    const fn = formula ? PRESET_FORMULAS[formula] : undefined;
    const n = 20;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= n; i++) {
      const x = min + ((max - min) * i) / n;
      const y = fn ? fn(x) : x;
      pts.push({ x, y });
    }
    return pts;
  }, [min, max, formula]);

  const currentY = formula ? (PRESET_FORMULAS[formula]?.(val) ?? val) : val;
  // 归一化到 SVG 坐标
  const ys = points.map((p) => p.y);
  const yMax = Math.max(...ys, currentY, 1);
  const yMin = Math.min(...ys, 0);
  const W = 200, H = 60;
  const toX = (x: number) => ((x - min) / (max - min || 1)) * W;
  const toY = (y: number) => H - ((y - yMin) / (yMax - yMin || 1)) * H;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground">
          x={val} → y={Number.isFinite(currentY) ? currentY.toFixed(2) : "-"}
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="rounded border border-border bg-background">
        {chartType === "line" ? (
          <polyline
            points={points.map((p) => `${toX(p.x)},${toY(p.y)}`).join(" ")}
            fill="none"
            stroke="var(--color-roadmap-fill, currentColor)"
            strokeWidth="2"
          />
        ) : (
          points.map((p, i) => (
            <rect
              key={i}
              x={toX(p.x) - 2}
              y={toY(p.y)}
              width="4"
              height={H - toY(p.y)}
              fill="var(--color-roadmap-fill, currentColor)"
              opacity="0.7"
            />
          ))
        )}
        {/* 当前值标记 */}
        <circle cx={toX(val)} cy={toY(currentY)} r="3" fill="var(--color-primary, currentColor)" />
      </svg>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-[var(--color-roadmap-fill)]"
      />
    </div>
  );
}
