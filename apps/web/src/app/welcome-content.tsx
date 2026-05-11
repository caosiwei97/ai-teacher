"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ThreeColumnLayout } from "@/components/layout/three-column";
import {
  GraduationCap,
  Brain,
  Heart,
  Utensils,
  Landmark,
  MessageSquare,
  TrendingUp,
  ArrowUp,
  Loader2,
  Settings,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getLlmConfigs, type LlmConfig } from "@/lib/api-client";
import { getProviderDisplay } from "@/lib/llm-presets";

const iconMap: Record<string, LucideIcon> = {
  Brain,
  Heart,
  Utensils,
  Landmark,
  MessageSquare,
  TrendingUp,
};

const fallbackTopics = [
  { id: "topic-1", icon: "Brain", title: "AI 提示词工程" },
  { id: "topic-2", icon: "Brain", title: "用 LangGraph 搭建 AI Agent" },
  { id: "topic-3", icon: "Heart", title: "科学减脂与身材管理" },
  { id: "topic-4", icon: "Heart", title: "情绪管理与压力释放" },
  { id: "topic-5", icon: "TrendingUp", title: "个人投资理财入门" },
  { id: "topic-6", icon: "MessageSquare", title: "自媒体运营与个人品牌" },
];

interface Session {
  id: string;
  topic: string;
  status: string;
  progress: { totalNodes: number; masteredNodes: number };
}

interface Topic {
  id: string;
  icon: string;
  title: string;
}

const USER_ID = "seed-user-ai-teacher";

interface WelcomeContentProps {
  sessions: Session[];
}

export function WelcomeContent({ sessions }: WelcomeContentProps) {
  const router = useRouter();
  const [sessionList, setSessionList] = useState<Session[]>(sessions);
  const [topics, setTopics] = useState<Topic[]>(fallbackTopics);
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [teachingMode, setTeachingMode] = useState<"warm" | "strict">("warm");
  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions?userId=${USER_ID}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setSessionList(data.sessions))
      .catch(() => setSessionList([]));
  }, []);

  useEffect(() => {
    fetch(`/api/suggested-topics`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setTopics(data.topics))
      .catch(() => setTopics(fallbackTopics));
  }, []);

  useEffect(() => {
    getLlmConfigs(USER_ID)
      .then((data) => {
        setLlmConfigs(data.configs);
        const defaultConfig = data.configs.find((c) => c.isDefault);
        if (defaultConfig) {
          setSelectedConfigId(defaultConfig.id);
        } else if (data.configs.length > 0) {
          setSelectedConfigId(data.configs[0].id);
        }
      })
      .catch(() => setLlmConfigs([]));
  }, []);

  const createSession = useCallback(
    async (topic: string) => {
      if (creating || !topic.trim()) return;
      setCreating(true);
      try {
        const res = await fetch(`/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "seed-user-ai-teacher",
            topic: topic.trim(),
            teachingMode,
            llmConfigId: selectedConfigId || undefined,
          }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        router.push(`/learn/${data.session.id}`);
      } catch {
        setCreating(false);
      }
    },
    [creating, router, teachingMode, selectedConfigId],
  );

  const handleSubmit = useCallback(
    (e: { preventDefault: () => void }) => {
      e.preventDefault();
      createSession(input);
    },
    [input, createSession],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        createSession(input);
      }
    },
    [input, createSession],
  );

  const handleSelectSession = useCallback(
    (id: string) => {
      router.push(`/learn/${id}`);
    },
    [router],
  );

  const handleNewSession = useCallback(() => {}, []);

  const selectedConfig = llmConfigs.find((c) => c.id === selectedConfigId);

  return (
    <ThreeColumnLayout
      sessions={sessionList}
      onSelectSession={handleSelectSession}
      onNewSession={handleNewSession}
    >
      <div className="flex h-full flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-lg flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>

          <h1 className="mt-4 text-xl font-semibold text-foreground">
            你好，我是 AI Teacher
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            告诉我你对什么感兴趣，从零到精通，我带你
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 flex w-full max-w-lg flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="你想学什么？"
                disabled={creating}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                style={{ minHeight: "48px" }}
              />
              <button
                type="submit"
                disabled={!input.trim() || creating}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 self-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:text-foreground"
                >
                  {selectedConfig ? (
                    <>
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: getProviderDisplay(selectedConfig.provider) ? `var(--color-primary)` : undefined }}
                      />
                      {selectedConfig.defaultModel}
                    </>
                  ) : llmConfigs.length === 0 ? (
                    <>
                      <Settings className="h-3 w-3" />
                      未配置模型
                    </>
                  ) : (
                    "选择模型"
                  )}
                  <ChevronDown className="h-3 w-3" />
                </button>

                {modelDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                    <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-xl border border-border bg-popover p-1.5 shadow-lg" style={{ minWidth: "200px" }}>
                      {llmConfigs.map((config) => {
                        const display = getProviderDisplay(config.provider);
                        return (
                          <button
                            key={config.id}
                            type="button"
                            onClick={() => {
                              setSelectedConfigId(config.id);
                              setModelDropdownOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                              config.id === selectedConfigId
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {display && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: `var(--color-primary)` }}
                              />
                            )}
                            <span className="flex-1 truncate">{config.defaultModel}</span>
                            {config.isDefault && (
                              <span className="text-[10px] text-muted-foreground">默认</span>
                            )}
                          </button>
                        );
                      })}
                      {llmConfigs.length > 0 && (
                        <div className="my-1 border-t border-border" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setModelDropdownOpen(false);
                          router.push("/settings");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Settings className="h-3 w-3" />
                        管理模型配置
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setTeachingMode("warm")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  teachingMode === "warm"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                😊 温暖私教
              </button>
              <button
                type="button"
                onClick={() => setTeachingMode("strict")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  teachingMode === "strict"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                🔥 严格教练
              </button>
            </div>
          </form>

          {!creating && (
            <>
              <p className="mt-8 text-xs text-muted-foreground">或者试试这些</p>

              <div className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                {topics.map((topic) => {
                  const Icon = iconMap[topic.icon] ?? Brain;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => createSession(topic.title)}
                      disabled={creating}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-all duration-200 hover:bg-secondary hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 disabled:opacity-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="line-clamp-2 text-[13px] leading-snug">{topic.title}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </ThreeColumnLayout>
  );
}
