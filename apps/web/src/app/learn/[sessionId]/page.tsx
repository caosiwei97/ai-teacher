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
import { Loader2, Sparkles, FileQuestion } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

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

  const chat = useChatStream(sessionId, {
    onFinish: () => {
      fetchSession(sessionId)
        .then((data) => {
          setNodes(data.session.roadmap?.nodes ?? []);
        })
        .catch(console.error);
    },
  });

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

    Promise.all([fetchSessions(USER_ID), fetchSession(sessionId)])
      .then(([sessionsData, sessionData]) => {
        if (sessionData.session.status === "archived") {
          setPageError("该学习会话已被归档");
          setLoaded(true);
          return;
        }

        setSessions(sessionsData.sessions);
        setNodes(sessionData.session.roadmap?.nodes ?? []);

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
      })
      .catch((err) => {
        console.error("Failed to load session:", err);
        setPageError("找不到该学习会话，可能已被删除");
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
      setNodes(sessionData.session.roadmap?.nodes ?? []);

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
            <FileQuestion className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-foreground">
              会话不存在
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
      onSelectSession={handleSelectSession}
      onNewSession={handleNewSession}
      onArchiveSession={handleArchiveSession}
    >
      {showDiagnostic && (
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
      )}
      {showDone && (
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
      )}
      {!showDiagnostic && !showDone && (
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
