import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface StartupCardProps {
  topic: string;
  onSubmit: (info: { motivation?: string; level?: string }) => void;
  onSkip: () => void;
}

const motivations = [
  { value: "工作需要", desc: "解决实际问题" },
  { value: "兴趣驱动", desc: "单纯想了解" },
  { value: "备考应试", desc: "应对考试面试" },
];

const levels = [
  { value: "零基础", desc: "完全没接触过" },
  { value: "有一些了解", desc: "知道皮毛" },
  { value: "比较熟悉", desc: "想深入精进" },
];

// 起步页（spec §5.3②）：2 问题点选可跳过，提交后进入对话流
// 注：053 纯前端，起步页为轻量 UI 前置；完整"替代诊断仪式"需改 agent prompt，留后续
export function StartupCard({ topic, onSubmit, onSkip }: StartupCardProps) {
  const [motivation, setMotivation] = useState<string>();
  const [level, setLevel] = useState<string>();

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">开始学习「{topic}」</h2>
        <p className="mt-2 text-sm text-muted-foreground">两个小问题，帮我更好地教你（可跳过）</p>
      </div>

      <div className="mb-6">
        <p className="mb-3 text-sm font-medium text-foreground">你的动机是？</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {motivations.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMotivation(m.value)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                motivation === m.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              <p className="text-sm font-medium">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <p className="mb-3 text-sm font-medium text-foreground">你的水平？</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {levels.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLevel(l.value)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                level === l.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              <p className="text-sm font-medium">{l.value}</p>
              <p className="text-xs text-muted-foreground">{l.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          跳过，直接开始
        </button>
        <button
          type="button"
          onClick={() => onSubmit({ motivation, level })}
          disabled={!motivation && !level}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          开始学习
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
