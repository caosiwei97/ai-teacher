"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, BookOpen, Loader2 } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

interface SessionInfo {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  progress: {
    totalNodes: number;
    masteredNodes: number;
    currentNodeId: string | null;
    currentNodeTitle: string | null;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState("");

  useEffect(() => {
    fetch(`/api/sessions?userId=${encodeURIComponent(USER_ID)}`)
      .then((res) => res.json())
      .then((data) => {
        setSessions(data.sessions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse-soft rounded-full bg-roadmap-fill" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-active">
            <GraduationCap className="h-4 w-4 text-sidebar-active-text" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">AI Teacher</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <section className="mb-10">
          <h2 className="mb-4 text-base font-medium text-foreground">
            开始学习
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="输入你想学的主题，例如：React Hooks、TypeScript 泛型"
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
              {creating ? "创建中..." : "创建"}
            </button>
          </div>
        </section>

        {sessions.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-medium text-foreground">
              继续学习
            </h2>
            <div className="space-y-2">
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
                    type="button"
                    onClick={() => router.push(`/learn/${s.id}`)}
                    className="flex w-full items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left transition-colors hover:border-roadmap-fill/50 hover:bg-roadmap-fill/5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <BookOpen className="h-5 w-5 text-roadmap-fill" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {s.topic}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-roadmap-track">
                          <div
                            className="h-1 rounded-full bg-roadmap-fill transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {s.progress.masteredNodes}/{s.progress.totalNodes}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        s.status === "diagnosing"
                          ? "bg-roadmap-fill/10 text-roadmap-fill"
                          : s.status === "completed"
                            ? "bg-roadmap-mastered/10 text-roadmap-mastered"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {s.status === "diagnosing"
                        ? "待诊断"
                        : s.status === "completed"
                          ? "已完成"
                          : "学习中"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
