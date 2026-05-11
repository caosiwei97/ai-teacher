"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ThreeColumnLayout } from "@/components/layout/three-column";
import {
  isAssessmentCardData,
  type AssessmentCardProps,
} from "@/components/chat/assessment-card";
import { ChatArea } from "@/components/chat/chat-area";
import { QuickQuestion } from "@/components/chat/quick-question";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { MessageMetadata } from "@/hooks/use-chat-stream";
import {
  fetchSession,
  fetchSessions,
  archiveSession,
} from "@/lib/api-client";
import type { UIMessage } from "ai";
import { GraduationCap } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

const fallbackTopics = [
  { id: "t1", title: "AI 提示词工程" },
  { id: "t2", title: "用 LangGraph 搭建 AI Agent" },
  { id: "t3", title: "科学减脂与身材管理" },
  { id: "t4", title: "情绪管理与压力释放" },
  { id: "t5", title: "个人投资理财入门" },
  { id: "t6", title: "自媒体运营与个人品牌" },
];

interface SessionInfo {
  id: string;
  topic: string;
  status: string;
  progress: { totalNodes: number; masteredNodes: number; currentNodeId: string | null };
}

interface NodeInfo {
  id: string;
  index: number;
  title: string;
  description: string;
  status: string;
  masteryScore: number;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

interface JsonObject {
  [key: string]: JsonValue;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAssessmentFromMetadata(metadata: unknown) {
  if (!isObject(metadata) || !Array.isArray(metadata.toolResults)) {
    return undefined;
  }

  for (const toolResult of metadata.toolResults) {
    if (!isObject(toolResult) || toolResult.toolName !== "generateAssessment") {
      continue;
    }

    if (isAssessmentCardData(toolResult.result)) {
      return toolResult.result;
    }
  }

  return undefined;
}

function toAssessmentAnnotation(assessment: AssessmentCardProps): JsonObject {
  return {
    assessment: {
      summary: assessment.summary,
      reviewTable: assessment.reviewTable.map((row) => ({
        points: row.points,
        yourAnswer: row.yourAnswer,
        accuracy: row.accuracy,
      })),
      coreTags: [...assessment.coreTags],
      nextNodeTitle: assessment.nextNodeTitle,
    },
  };
}

export default function LearnPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [teachingMode, setTeachingMode] = useState<"warm" | "strict" | "interviewer">("warm");
  const [chatError, setChatError] = useState<string | null>(null);
  const [diagnosticSubmitted, setDiagnosticSubmitted] = useState(false);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined);

  const [codePanel, setCodePanel] = useState<{
    code: string;
    language: string;
    instruction?: string;
  } | null>(null);

  const chat = useChatStream(sessionId, {
    teachingMode,
    onFinish: () => {
      if (isNewSession) {
        setIsNewSession(false);
        fetchSessions(USER_ID)
          .then((data) => setSessions(data.sessions))
          .catch(console.error);
      }
      fetchSession(sessionId)
        .then((data) => {
          if (data) {
            setNodes(data.session.roadmap?.nodes ?? []);
          }
        })
        .catch(console.error);
    },
    onError: (error) => {
      setChatError(error);
      setTimeout(() => setChatError(null), 5000);
    },
    onRoadmapUpdate: (updatedNodes) => {
      setNodes(updatedNodes as NodeInfo[]);
    },
    onSessionUpdate: (data) => {
      if (data.masteredNodes !== undefined && data.totalNodes !== undefined) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  progress: {
                    ...s.progress,
                    masteredNodes: data.masteredNodes!,
                    totalNodes: data.totalNodes!,
                  },
                }
              : s,
          ),
        );
      }
    },
  });

  useEffect(() => {
    const lastMsg = chat.messages[chat.messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.metadata?.annotations) {
      for (const ann of [...lastMsg.metadata.annotations].reverse()) {
        if (ann.codePush) {
          setCodePanel(ann.codePush);
          break;
        }
      }
    }
  }, [chat.messages]);

  useEffect(() => {
    if (!sessionId) return;

    fetchSessions(USER_ID)
      .then((data) => {
        const sessionsList = data.sessions;
        const exists = sessionsList.some((s) => s.id === sessionId);

        if (!exists) {
          return fetchSession(sessionId).then((sessionData) => {
            if (sessionData) {
              const nodes = sessionData.session.roadmap?.nodes ?? [];
              const virtualSession: SessionInfo = {
                id: sessionId,
                topic: sessionData.session.topic || "新对话",
                status: sessionData.session.status || "active",
                progress: {
                  totalNodes: nodes.length,
                  masteredNodes: nodes.filter((n: NodeInfo) => n.status === "mastered").length,
                  currentNodeId: nodes.find((n: NodeInfo) => n.status === "in-progress")?.id ?? null,
                },
              };
              setSessions([virtualSession, ...sessionsList]);
              setNodes(nodes);
            } else {
              const virtualSession: SessionInfo = {
                id: sessionId,
                topic: "新对话",
                status: "new",
                progress: { totalNodes: 0, masteredNodes: 0, currentNodeId: null },
              };
              setSessions([virtualSession, ...sessionsList]);
              setNodes([]);
            }
            setIsNewSession(true);
            setLoaded(true);
          });
        }

        return fetchSession(sessionId).then((sessionData) => {
          if (!sessionData) {
            setSessions(sessionsList);
            setIsNewSession(false);
            setLoaded(true);
            return;
          }

          if (sessionData.session.status === "archived") {
            setPageError("该学习会话已被归档");
            setLoaded(true);
            return;
          }

          setSessions(sessionsList);
          setNodes(sessionData.session.roadmap?.nodes ?? []);
          setIsNewSession(false);

          const historyMessages: UIMessage<MessageMetadata>[] = sessionData.session.messages
            .filter((m) => (m.role === "learner" || m.role === "tutor") && !m.hidden)
            .map((m, i) => {
              const assessment =
                m.type === "assessment" ? getAssessmentFromMetadata(m.metadata) : undefined;

              return {
                id: `init-${i}`,
                role: (m.role === "learner" ? "user" : "assistant") as "user" | "assistant",
                parts: [{ type: "text" as const, text: m.content || "" }],
                metadata: assessment ? { annotations: [toAssessmentAnnotation(assessment) as unknown as import("@/hooks/use-chat-stream").AnnotationData] } : undefined,
              } satisfies UIMessage<MessageMetadata>;
            });
          chat.setMessages(historyMessages);

          setLoaded(true);
        });
      })
      .catch((err) => {
        console.error("Failed to load session:", err);
        setPageError("加载会话失败，请稍后重试");
        setLoaded(true);
      });
  }, [sessionId]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id !== sessionId) {
        router.push(`/learn/${id}`);
      }
    },
    [sessionId, router],
  );

  const handleNewSession = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleArchiveSession = useCallback(
    async (id: string) => {
      try {
        await archiveSession(id);
        const data = await fetchSessions(USER_ID);
        setSessions(data.sessions);
      } catch (err) {
        console.error("Failed to archive session:", err);
      }
    },
    [],
  );

  const handleCodePanelChange = useCallback(
    (code: string) => {
      setCodePanel((prev) => (prev ? { ...prev, code } : null));
    },
    [],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChatError(null);
    if (chat.input.trim()) {
      chat.handleSubmit(e);
    }
  }

  function handleTopicClick(topic: string) {
    chat.submitMessage(`学习${topic}`);
  }

  function getLastAssistantMessage() {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === "assistant") {
        const parts = chat.messages[i].parts;
        if (parts) {
          return parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("");
        }
        return "";
      }
    }
    return "";
  }

  async function handleSuggest() {
    const lastAssistantMsg = getLastAssistantMessage();
    if (!lastAssistantMsg) return;

    setIsSuggesting(true);
    setSuggestion(undefined);

    try {
      const response = await fetch("/api/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          currentQuestion: lastAssistantMsg,
        }),
      });

      if (!response.ok) {
        setSuggestion("获取提示失败，请重试");
        return;
      }

      const data = await response.json();
      setSuggestion(data.suggestion);
    } catch {
      setSuggestion("获取提示失败，请重试");
    } finally {
      setIsSuggesting(false);
    }
  }

  function handleApplySuggestion() {
    if (!suggestion) return;
    const syntheticEvent = {
      target: { value: suggestion },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    chat.handleInputChange(syntheticEvent);
    setSuggestion(undefined);
  }

  function handleDismissSuggestion() {
    setSuggestion(undefined);
  }

  async function handleDiagnosticSubmit(
    answers: Array<{ questionId: string; optionId: string; optionText: string }>,
  ) {
    setDiagnosticSubmitted(true);

    const answerLines = answers.map(
      (a) => `${a.questionId}: ${a.optionId} (${a.optionText})`,
    );
    const hiddenContent = `[Quiz Response] ${answerLines.join(" | ")}`;

    const assistantMessage: UIMessage<MessageMetadata> = {
      id: `assistant-diag-${Date.now()}`,
      role: "assistant",
      parts: [{ type: "text" as const, text: "" }],
      metadata: { annotations: [] },
    };

    const newMessages = [...chat.messages, assistantMessage];
    chat.setMessages(newMessages);

    try {
      const postRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: [{ role: "user", content: hiddenContent }],
          hidden: true,
        }),
      });

      if (!postRes.ok) throw new Error(`Failed: ${postRes.status}`);

      const sseRes = await fetch(`/api/chat/${sessionId}/stream`);
      if (!sseRes.ok) throw new Error(`Stream failed: ${sseRes.status}`);

      const reader = sseRes.body?.getReader();
      if (!reader) throw new Error("No stream body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const sseParts = buffer.split("\n\n");
        buffer = sseParts.pop() || "";

        for (const part of sseParts) {
          const lines = part.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;

            let event: { type: string; content?: string; data?: unknown };
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            const assistantIdx = newMessages.length - 1;

            if (event.type === "text-delta" && typeof event.content === "string") {
              const prevText = newMessages[assistantIdx].parts
                ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("") ?? "";
              const updatedText = prevText + event.content;
              newMessages[assistantIdx] = {
                ...newMessages[assistantIdx],
                parts: [{ type: "text" as const, text: updatedText }],
              };
              chat.setMessages([...newMessages]);
            }

            if (event.type === "roadmap-updated" && event.data) {
              const data = event.data as { nodes: NodeInfo[] };
              setNodes(data.nodes);
            }

            if (event.type === "session-updated" && event.data) {
              const data = event.data as { masteredNodes?: number; totalNodes?: number };
              if (data.totalNodes !== undefined) {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === sessionId
                      ? {
                          ...s,
                          progress: {
                            ...s.progress,
                            totalNodes: data.totalNodes!,
                            masteredNodes: data.masteredNodes ?? 0,
                          },
                        }
                      : s,
                  ),
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Diagnostic submit error:", err);
    }

    fetchSession(sessionId)
      .then((data) => {
        if (data) {
          setNodes(data.session.roadmap?.nodes ?? []);
        }
        return fetchSessions(USER_ID);
      })
      .then((data) => {
        if (data) setSessions(data.sessions);
      })
      .catch(console.error);
  }

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse-soft rounded-full bg-roadmap-fill" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <GraduationCap className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-foreground">
              加载失败
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pageError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThreeColumnLayout
      sessions={sessions}
      currentSessionId={sessionId}
      nodes={nodes}
      codePanel={codePanel}
      onCodePanelChange={handleCodePanelChange}
      onSelectSession={handleSelectSession}
      onNewSession={handleNewSession}
      onArchiveSession={handleArchiveSession}
    >
      {isNewSession ? (
        <>
          <ChatArea
            messages={chat.messages}
            input={chat.input}
            isLoading={chat.isLoading}
            onInputChange={chat.handleInputChange}
            onSubmit={handleSubmit}
            onStop={chat.stop}
            isSuggesting={isSuggesting}
            suggestion={suggestion}
            onSuggest={handleSuggest}
            onApplySuggestion={handleApplySuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onDiagnosticSubmit={handleDiagnosticSubmit}
            diagnosticSubmitted={diagnosticSubmitted}
            teachingMode={teachingMode}
            onTeachingModeChange={setTeachingMode}
            error={chatError}
            welcomeContent={
              <div className="flex flex-col items-center pt-16 pb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-roadmap-fill/10">
                  <GraduationCap className="h-6 w-6 text-roadmap-fill" />
                </div>
                <h1 className="mt-4 text-xl font-semibold text-foreground">
                  你好，我是 AI Teacher
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  告诉我你对什么感兴趣，从零到精通，我带你
                </p>
                <p className="mt-8 text-xs text-muted-foreground">或者试试这些</p>
                <div className="mt-3 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                  {fallbackTopics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => handleTopicClick(topic.title)}
                      disabled={chat.isLoading}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-left text-foreground transition-all duration-200 hover:bg-secondary hover:border-roadmap-fill/20 hover:shadow-lg hover:shadow-roadmap-fill/5 disabled:opacity-50"
                    >
                      <span className="text-sm leading-snug">{topic.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            }
          />
          <QuickQuestion sessionId={sessionId} />
        </>
      ) : (
        <>
          <ChatArea
            messages={chat.messages}
            input={chat.input}
            isLoading={chat.isLoading}
            onInputChange={chat.handleInputChange}
            onSubmit={handleSubmit}
            onStop={chat.stop}
            isSuggesting={isSuggesting}
            suggestion={suggestion}
            onSuggest={handleSuggest}
            onApplySuggestion={handleApplySuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onDiagnosticSubmit={handleDiagnosticSubmit}
            diagnosticSubmitted={diagnosticSubmitted}
            teachingMode={teachingMode}
            onTeachingModeChange={setTeachingMode}
            error={chatError}
          />
          <QuickQuestion sessionId={sessionId} />
        </>
      )}
    </ThreeColumnLayout>
  );
}
