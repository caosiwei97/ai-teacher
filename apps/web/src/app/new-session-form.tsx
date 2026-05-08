"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, Loader2 } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

export function NewSessionForm() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState("");

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
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-active">
            <GraduationCap className="h-4 w-4 text-sidebar-active-text" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">AI Teacher</h1>
        </div>
      </header>

      <main className="mx-auto flex flex-1 max-w-3xl px-6 py-12">
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              开始你的学习之旅
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              输入一个你想学的主题，AI 私教会为你定制学习路径
            </p>
          </div>

          <div className="flex w-full max-w-lg gap-3">
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
        </div>
      </main>
    </div>
  );
}
