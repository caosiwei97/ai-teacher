"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, Loader2, BookOpen, Clock, Sparkles } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

interface SessionCard {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  progress: { totalNodes: number; masteredNodes: number };
}

interface HomeDashboardProps {
  sessions: SessionCard[];
}

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "diagnosing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        <Sparkles className="h-3 w-3" />
        诊断中
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        学习中
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <BookOpen className="h-3 w-3" />
        已完成
      </span>
    );
  }
  return null;
}

function borderClass(status: string) {
  if (status === "diagnosing") return "border-l-blue-400";
  if (status === "active") return "border-l-amber-400";
  if (status === "completed") return "border-l-green-400";
  return "border-l-muted-foreground";
}

export function HomeDashboard({ sessions }: HomeDashboardProps) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!topic.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, topic: topic.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const { session } = await res.json();
      router.push(`/learn/${session.id}`);
    } catch (err) {
      console.error(err);
      setCreating(false);
    }
  }, [topic, creating, router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-active">
            <GraduationCap className="h-4 w-4 text-sidebar-active-text" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">AI Teacher</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-10 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            开始新的学习
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            输入一个你想学的主题，AI 私教会为你定制学习路径
          </p>
        </div>

        <div className="mx-auto mb-12 flex max-w-lg gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="例如：React Hooks、TypeScript 泛型、机器学习基础"
            className="flex-1 rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-roadmap-fill focus:outline-none focus:ring-1 focus:ring-roadmap-fill"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!topic.trim() || creating}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {creating ? "创建中..." : "开始"}
          </button>
        </div>

        {sessions.length > 0 && (
          <>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              我的会话
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sessions.map((s) => {
                const progress =
                  s.progress.totalNodes > 0
                    ? Math.round(
                        (s.progress.masteredNodes / s.progress.totalNodes) * 100,
                      )
                    : 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/learn/${s.id}`)}
                    className={`group rounded-xl border border-border border-l-[3px] ${borderClass(s.status)} bg-card px-4 py-3.5 text-left transition-all hover:shadow-md`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {s.topic}
                      </p>
                      <StatusBadge status={s.status} />
                    </div>
                    {s.progress.totalNodes > 0 && (
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-muted">
                          <div
                            className="h-1 rounded-full bg-roadmap-fill transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {s.progress.masteredNodes}/{s.progress.totalNodes}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(s.updatedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {sessions.length === 0 && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              还没有学习会话，输入主题开始你的第一课
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
