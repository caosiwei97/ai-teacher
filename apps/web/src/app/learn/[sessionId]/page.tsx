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
import { DiagnosticQuiz } from "@/components/diagnostic/diagnostic-quiz";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { MessageMetadata } from "@/hooks/use-chat-stream";
import {
  fetchSession,
  fetchSessions,
  generateDiagnostic,
  evaluateDiagnostic,
  archiveSession,
} from "@/lib/api-client";
import type { UIMessage } from "ai";
import { Loader2, Sparkles, GraduationCap, ArrowUp } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

const fallbackTopics = [
  { id: "t1", title: "JavaScript 闭包" },
  { id: "t2", title: "认知行为疗法入门" },
  { id: "t3", title: "营养学基础" },
  { id: "t4", title: "文艺复兴艺术" },
  { id: "t5", title: "高效沟通技巧" },
  { id: "t6", title: "概率思维" },
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

interface DiagnosticQuestion {
  id: string;
  nodeIndex: number;
  question: string;
  type: "choice" | "open";
  options: Array<{ label: string; text: string }>;
  correctAnswer: string;
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
  const [newSessionInput, setNewSessionInput] = useState("");
  const [creating, setCreating] = useState(false);

  const [diagnosticState, setDiagnosticState] = useState<
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "quiz"; questions: DiagnosticQuestion[] }
    | { phase: "evaluating" }
    | { phase: "done"; startingNode: { id: string; index: number; title: string } }
  >({ phase: "idle" });

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined);

  const [codePanel, setCodePanel] = useState<{
    code: string;
    language: string;
    instruction?: string;
  } | null>(null);

  const chat = useChatStream(sessionId, {
    onFinish: () => {
      fetchSession(sessionId)
        .then((data) => {
          if (data) {
            setNodes(data.session.roadmap?.nodes ?? []);
          }
        })
        .catch(console.error);
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

  function loadDiagnostic() {
    setDiagnosticState({ phase: "loading" });
    generateDiagnostic(sessionId)
      .then((data) => {
        setDiagnosticState({ phase: "quiz", questions: data.questions });
      })
      .catch((err) => {
        console.error("Failed to generate diagnostic:", err);
        setDiagnosticState({
          phase: "error",
          message: "诊断题目生成失败，可能是网络问题或服务繁忙",
        });
      });
  }

  function handleSkipDiagnostic() {
    setDiagnosticState({ phase: "idle" });
  }

  useEffect(() => {
    if (!sessionId) return;

    fetchSessions(USER_ID)
      .then((data) => {
        const sessionsList = data.sessions;
        const exists = sessionsList.some((s) => s.id === sessionId);

        if (!exists) {
          const virtualSession: SessionInfo = {
            id: sessionId,
            topic: "新对话",
            status: "new",
            progress: { totalNodes: 0, masteredNodes: 0, currentNodeId: null },
          };
          setSessions([virtualSession, ...sessionsList]);
          setNodes([]);
          setDiagnosticState({ phase: "idle" });
          setIsNewSession(true);
          setLoaded(true);
          return;
        }

        return fetchSession(sessionId).then((sessionData) => {
          if (!sessionData) {
            setSessions(sessionsList);
            setIsNewSession(false);
            setDiagnosticState({ phase: "idle" });
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
            .filter((m) => m.role === "learner" || m.role === "tutor")
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

          if (sessionData.session.status === "diagnosing") {
            loadDiagnostic();
          } else {
            setDiagnosticState({ phase: "idle" });
          }

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

  const handleCreateFromNewSession = useCallback(
    async (topic: string) => {
      if (creating || !topic.trim()) return;
      setCreating(true);
      try {
        const res = await fetch(`/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: USER_ID, topic: topic.trim(), teachingMode: "warm" }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        router.push(`/learn/${data.session.id}`);
      } catch {
        setCreating(false);
      }
    },
    [creating, router],
  );

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
    if (chat.input.trim()) {
      chat.handleSubmit(e);
    }
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
    answers: Array<{ questionId: string; answer: string }>,
  ) {
    if (diagnosticState.phase !== "quiz") return;

    setDiagnosticState({ phase: "evaluating" });

    try {
      const questions = diagnosticState.questions.map((q) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        correctAnswer: q.correctAnswer,
        nodeIndex: q.nodeIndex,
      }));

      const result = await evaluateDiagnostic(sessionId, {
        questions,
        answers,
      });

      const sessionData = await fetchSession(sessionId);
      if (sessionData) {
        setNodes(sessionData.session.roadmap?.nodes ?? []);
      }

      setDiagnosticState({
        phase: "done",
        startingNode: result.startingNode,
      });
    } catch (err) {
      console.error("Failed to evaluate diagnostic:", err);
      setDiagnosticState({ phase: "quiz", questions: diagnosticState.questions });
    }
  }

  function handleStartLearning() {
    setDiagnosticState({ phase: "idle" });
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

  const showDiagnostic =
    diagnosticState.phase === "loading" ||
    diagnosticState.phase === "error" ||
    diagnosticState.phase === "quiz" ||
    diagnosticState.phase === "evaluating";

  const showDone = diagnosticState.phase === "done";

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
        <div className="flex h-full flex-col items-center justify-center px-6">
          <div className="flex w-full max-w-lg flex-col items-center">
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
            <div className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              {fallbackTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => handleCreateFromNewSession(topic.title)}
                  disabled={creating}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-all duration-200 hover:bg-secondary hover:border-roadmap-fill/20 hover:shadow-lg hover:shadow-roadmap-fill/5 disabled:opacity-50"
                >
                  <span className="line-clamp-2 text-[13px] leading-snug">{topic.title}</span>
                </button>
              ))}
            </div>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreateFromNewSession(newSessionInput); }}
            className="mt-8 flex w-full max-w-lg items-center gap-2"
          >
            <input
              type="text"
              value={newSessionInput}
              onChange={(e) => setNewSessionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateFromNewSession(newSessionInput);
                }
              }}
              placeholder="你想学什么？"
              disabled={creating}
              className="flex-1 rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground focus:border-roadmap-fill focus:outline-none focus:ring-1 focus:ring-roadmap-fill disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newSessionInput.trim() || creating}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </form>
        </div>
      ) : showDiagnostic ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-border bg-card px-5 py-4">
            <div className="mx-auto flex max-w-2xl items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-roadmap-fill/10">
                <Sparkles className="h-5 w-5 text-roadmap-fill" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-foreground">
                  诊断摸底
                </h2>
                <p className="text-xs text-muted-foreground">
                  回答几个问题，帮你找到合适的学习起点
                </p>
              </div>
            </div>
          </div>
          {diagnosticState.phase === "loading" ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-roadmap-fill" />
                <p className="text-sm text-muted-foreground">
                  正在生成诊断题目…
                </p>
              </div>
            </div>
          ) : diagnosticState.phase === "error" ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
                  <Sparkles className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    生成失败
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {diagnosticState.message}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={loadDiagnostic}
                    className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    重试
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipDiagnostic}
                    className="rounded-xl border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
                  >
                    跳过诊断
                  </button>
                </div>
              </div>
            </div>
          ) : diagnosticState.phase === "quiz" ? (
            <DiagnosticQuiz
              questions={diagnosticState.questions}
              onSubmit={handleDiagnosticSubmit}
              isSubmitting={false}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-roadmap-fill" />
                <p className="text-sm text-muted-foreground">
                  正在评估你的水平…
                </p>
              </div>
            </div>
          )}
        </div>
      ) : showDone ? (
        <div className="flex h-full flex-col">
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-roadmap-mastered/10">
                <Sparkles className="h-7 w-7 text-roadmap-mastered" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  诊断完成！
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  建议从「{diagnosticState.startingNode.title}」开始学习
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartLearning}
                className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                开始学习
              </button>
            </div>
          </div>
        </div>
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
          />
          <QuickQuestion sessionId={sessionId} />
        </>
      )}
    </ThreeColumnLayout>
  );
}
