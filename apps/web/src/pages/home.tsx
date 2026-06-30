import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getEnvStatus, createSession } from "@/lib/api-client";
import { useSession } from "@/contexts/session-context";
import { GraduationCap, ArrowRight, Loader2 } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

const suggestedTopics = [
  "AI 提示词工程",
  "用 LangGraph 搭建 AI Agent",
  "科学减脂与身材管理",
  "情绪管理与压力释放",
  "个人投资理财入门",
  "自媒体运营与个人品牌",
];

export function Component() {
  const navigate = useNavigate();
  const { sessions, setSessions } = useSession();
  const [ready, setReady] = useState<boolean | null>(null);
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const status = await getEnvStatus();
        setReady(status.hasDefaultDbConfig || status.hasEnvConfig);
      } catch {
        setReady(true); // 检测失败不阻塞
      }
    })();
  }, []);

  // 发消息才建会话：用户输入首条消息 → POST /api/sessions（topic=未命名对话）拿 id → 跳转带 firstMessage
  // learn 页接收 firstMessage 立即发起 chat 流（首条即触发诊断），无空态闪烁
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const newSession = await createSession(USER_ID, "未命名对话");
      setSessions((prev) => [newSession, ...prev]);
      navigate(`/learn/${newSession.id}`, {
        state: { firstMessage: trimmed },
        replace: true,
      });
    } catch (err) {
      console.error("Failed to create session:", err);
      setCreating(false);
    }
  }

  if (ready === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-pulse-soft rounded-full bg-roadmap-fill" />
      </div>
    );
  }

  if (ready === false) {
    // 软引导：主模型未就绪，提示但不强制（Phase 0）
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="mb-2 text-lg font-semibold text-foreground">检测到尚未配置模型</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            核心教学功能需要配置 API Key。先去配置，或先看看（部分功能可用）。
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate("/settings")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              去配置
            </button>
            <button
              onClick={() => setReady(true)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              先进入
            </button>
          </div>
        </div>
      </div>
    );
  }

  const learningSession = sessions.find(
    (s) => s.status === "active" || s.status === "diagnosing",
  );

  // 落地页（spec §5.3①）：大标题 + 输入框 + 推荐 chips + 三阶段示意
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            真正掌握，而不只是看过
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            从零到精通，AI 私教带你学 · 固 · 验，三阶段闭环让知识真正留下
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(topic);
          }}
          className="relative mb-4"
        >
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="输入你想学的，或直接提问，例如「React Hooks」"
            className="w-full rounded-xl border border-border bg-card px-4 py-3.5 pr-12 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={!topic.trim() || creating}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {suggestedTopics.map((t) => (
            <button
              key={t}
              onClick={() => sendMessage(t)}
              disabled={creating}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground disabled:opacity-40"
            >
              {t}
            </button>
          ))}
        </div>

        {learningSession && (
          <div className="mb-8 flex justify-center">
            <button
              onClick={() => navigate(`/learn/${learningSession.id}`, { replace: true })}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <span>继续上次学习：{learningSession.topic}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 三阶段闭环示意（spec §5.3①） */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-lg bg-card px-3 py-2">🌱 学习</span>
          <span className="text-muted-foreground/40">→</span>
          <span className="rounded-lg bg-card px-3 py-2">🔁 复习</span>
          <span className="text-muted-foreground/40">→</span>
          <span className="rounded-lg bg-card px-3 py-2">🔥 面试</span>
        </div>
      </div>
    </div>
  );
}
