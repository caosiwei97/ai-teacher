import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { ResizableDivider } from "@/components/layout/resizable-divider";
import {
  isAssessmentCardData,
  type AssessmentCardProps,
} from "@/components/chat/assessment-card";
import { ChatArea } from "@/components/chat/chat-area";
import { QuickQuestion } from "@/components/chat/quick-question";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { MessageMetadata, DiagnosticQuestionsData, AnnotationData } from "@/hooks/use-chat-stream";
import {
  fetchSession,
  fetchSessions,
  getLlmConfigs,
  type LlmConfig,
} from "@/lib/api-client";
import { useSession } from "@/contexts/session-context";
import { SandboxProvider } from "@/contexts/sandbox-context";
import type { UIMessage } from "ai";
import { GraduationCap, PanelRightClose, PanelRight } from "lucide-react";

const USER_ID = "seed-user-ai-teacher";

const fallbackTopics = [
  { id: "t1", title: "AI 提示词工程" },
  { id: "t2", title: "用 LangGraph 搭建 AI Agent" },
  { id: "t3", title: "科学减脂与身材管理" },
  { id: "t4", title: "情绪管理与压力释放" },
  { id: "t5", title: "个人投资理财入门" },
  { id: "t6", title: "自媒体运营与个人品牌" },
];

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

function getCodePushFromMetadata(metadata: unknown): { code: string; language: string; instruction?: string } | undefined {
  if (!isObject(metadata) || !Array.isArray(metadata.toolResults)) {
    return undefined;
  }

  for (const toolResult of metadata.toolResults) {
    if (!isObject(toolResult) || toolResult.toolName !== "pushCode") {
      continue;
    }
    const result = toolResult.result;
    if (isObject(result) && typeof result.code === "string") {
      return {
        code: result.code as string,
        language: (result.language as string) ?? "javascript",
        instruction: result.instruction as string | undefined,
      };
    }
  }

  return undefined;
}

function getUIBlocksFromMetadata(metadata: unknown): unknown[] | undefined {
  if (!isObject(metadata) || !Array.isArray(metadata.toolResults)) {
    return undefined;
  }

  for (const toolResult of metadata.toolResults) {
    if (!isObject(toolResult) || toolResult.toolName !== "renderUI") {
      continue;
    }
    const result = toolResult.result;
    if (isObject(result) && Array.isArray(result.uiBlocks) && result.uiBlocks.length > 0) {
      return result.uiBlocks as unknown[];
    }
  }

  return undefined;
}

function getDiagnosticQuestionsFromMetadata(metadata: unknown): DiagnosticQuestionsData | undefined {
  if (!isObject(metadata)) return undefined;

  if (Array.isArray((metadata as Record<string, unknown>).annotations)) {
    for (const ann of (metadata as Record<string, unknown>).annotations as Record<string, unknown>[]) {
      if (isObject(ann) && "diagnosticQuestions" in ann && ann.diagnosticQuestions) {
        const dq = ann.diagnosticQuestions as Record<string, unknown>;
        if (Array.isArray(dq.questions) && dq.questions.length > 0) {
          return dq as unknown as DiagnosticQuestionsData;
        }
      }
    }
  }

  if (Array.isArray((metadata as Record<string, unknown>).toolResults)) {
    for (const tr of (metadata as Record<string, unknown>).toolResults as Record<string, unknown>[]) {
      if (isObject(tr) && tr.toolName === "askQuestion" && isObject(tr.result)) {
        const result = tr.result as Record<string, unknown>;
        if (Array.isArray(result.questions)) {
          return result as unknown as DiagnosticQuestionsData;
        }
      }
    }
  }

  return undefined;
}

export function Component() {
  const params = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { setSessions, currentSessionId, refreshSessions } = useSession();

  const sessionId = currentSessionId ?? params.sessionId!;

  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const prevSessionRef = useRef<string | null>(null);
  const [teachingMode, setTeachingMode] = useState<"warm" | "strict" | "interviewer">("warm");
  const [chatError, setChatError] = useState<string | null>(null);
  const [diagnosticSubmitted, setDiagnosticSubmitted] = useState(false);
  const [diagnosticAnalyzing, setDiagnosticAnalyzing] = useState(false);

  const [masteryTransitionPending, setMasteryTransitionPending] = useState(false);
  const [nextNodeTitle, setNextNodeTitle] = useState<string | undefined>(undefined);
  const streamErrorRef = useRef(false);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined);

  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(undefined);
  const [hasEnvConfig, setHasEnvConfig] = useState(true);

  const [codePanel, setCodePanel] = useState<{
    code: string;
    language: string;
    instruction?: string;
  } | null>(null);

  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightTab, setRightTab] = useState<"roadmap" | "code">("roadmap");
  const containerRef = useRef<HTMLDivElement>(null);
  const [rightWidth, setRightWidth] = useState<number>(320);

  useEffect(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    if (containerWidth > 0) {
      const maxWidth = containerWidth * 0.7;
      if (codePanel) {
        setRightWidth(Math.min(Math.floor(containerWidth * 0.5), maxWidth));
      } else {
        setRightWidth(Math.min(320, maxWidth));
      }
    }
  }, [codePanel]);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((prev) => {
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      const minW = 280;
      const maxW = containerWidth > 0 ? Math.floor(containerWidth * 0.7) : 800;
      return Math.max(minW, Math.min(prev - delta, maxW));
    });
  }, []);

  const chat = useChatStream(sessionId, {
    teachingMode,
    llmConfigId: selectedConfigId,
    onFinish: () => {
      if (streamErrorRef.current) {
        streamErrorRef.current = false;
        return;
      }

      if (isNewSession) {
        setIsNewSession(false);
        refreshSessions();
      }
      if (masteryTransitionPending) {
        const title = nextNodeTitle;
        setTimeout(() => {
          const assistantMessage: UIMessage<MessageMetadata> = {
            id: `assistant-next-${Date.now()}`,
            role: "assistant",
            parts: [{ type: "text" as const, text: "" }],
            metadata: { annotations: [] },
          };
          chat.setMessages(prev => [...prev, assistantMessage]);

          (async () => {
            try {
              const postRes = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId,
                  messages: [{ role: "user", content: `[Continue] 开始教学知识点：${title ?? "下一个知识点"}` }],
                  hidden: true,
                  ...(selectedConfigId ? { llmConfigId: selectedConfigId } : {}),
                }),
              });

              if (!postRes.ok) {
                setMasteryTransitionPending(false);
                setNextNodeTitle(undefined);
                return;
              }

              chat.resumeStream();
            } catch {
              setMasteryTransitionPending(false);
              setNextNodeTitle(undefined);
            }
          })();
          setMasteryTransitionPending(false);
          setNextNodeTitle(undefined);
        }, 1500);
        return;
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
      streamErrorRef.current = true;
      setChatError(error);
      setMasteryTransitionPending(false);
      setNextNodeTitle(undefined);
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
    onMasteryTransition: (title) => {
      setMasteryTransitionPending(true);
      setNextNodeTitle(title);
    },
  });

  useEffect(() => {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const msg = chat.messages[i];
      if (msg.role === "assistant" && msg.metadata?.annotations) {
        for (const ann of [...msg.metadata.annotations].reverse()) {
          if (ann.codePush) {
            setCodePanel(ann.codePush);
            return;
          }
        }
      }
    }
  }, [chat.messages]);

  useEffect(() => {
    if (codePanel) {
      setRightTab("code");
    }
  }, [codePanel]);

  useEffect(() => {
    if (!sessionId) return;

    if (prevSessionRef.current && prevSessionRef.current !== sessionId) {
      chat.setMessages([]);
      setNodes([]);
      setCodePanel(null);
      setLoaded(false);
      setPageError(null);
      setIsNewSession(false);
      setDiagnosticSubmitted(false);
      setDiagnosticAnalyzing(false);
      setMasteryTransitionPending(false);
      setNextNodeTitle(undefined);
      streamErrorRef.current = false;
      setSuggestion(undefined);
    }
    prevSessionRef.current = sessionId;

    getLlmConfigs(USER_ID)
      .then((data) => setLlmConfigs(data.configs))
      .catch(() => setLlmConfigs([]));

    fetch(`/api/llm/env-status`)
      .then((r) => r.json())
      .then((data: { hasEnvConfig?: boolean }) => setHasEnvConfig(data.hasEnvConfig ?? false))
      .catch(() => setHasEnvConfig(false));

    fetchSessions(USER_ID)
      .then((data) => {
        const sessionsList = data.sessions;
        const exists = sessionsList.some((s) => s.id === sessionId);

        if (!exists) {
          return fetchSession(sessionId).then((sessionData) => {
            if (sessionData) {
              const fetchedNodes = sessionData.session.roadmap?.nodes ?? [];
              const virtualSession = {
                id: sessionId,
                topic: sessionData.session.topic || "新对话",
                status: sessionData.session.status || "active",
                progress: {
                  totalNodes: fetchedNodes.length,
                  masteredNodes: fetchedNodes.filter((n: NodeInfo) => n.status === "mastered").length,
                  currentNodeId: fetchedNodes.find((n: NodeInfo) => n.status === "in-progress")?.id ?? null,
                },
              };
              setSessions([virtualSession, ...sessionsList]);
              setNodes(fetchedNodes);
            } else {
              const virtualSession = {
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
          setSelectedConfigId((sessionData.session as Record<string, unknown>).llmConfigId as string | undefined);

          const historyMessages: UIMessage<MessageMetadata>[] = sessionData.session.messages
            .filter((m) => (m.role === "learner" || m.role === "tutor") && !m.hidden)
            .map((m, i) => {
              const assessment =
                m.type === "assessment" ? getAssessmentFromMetadata(m.metadata) : undefined;
              const diagnosticQuestions = getDiagnosticQuestionsFromMetadata(m.metadata);
              const uiBlocks = getUIBlocksFromMetadata(m.metadata);
              const codePush = getCodePushFromMetadata(m.metadata);
              const annotations: AnnotationData[] = [];
              if (assessment) annotations.push(toAssessmentAnnotation(assessment) as unknown as AnnotationData);
              if (diagnosticQuestions) annotations.push({ diagnosticQuestions });
              if (uiBlocks) annotations.push({ uiBlocks });
              if (codePush) annotations.push({ codePush } as unknown as AnnotationData);

              return {
                id: `init-${i}`,
                role: (m.role === "learner" ? "user" : "assistant") as "user" | "assistant",
                parts: [{ type: "text" as const, text: m.content || "" }],
                metadata: annotations.length > 0 ? { annotations } : undefined,
              } satisfies UIMessage<MessageMetadata>;
            });
          chat.setMessages(historyMessages);

          const hasActiveProcessing = sessionData.session.messages.some(
            (m) => m.status === "sending" || m.status === "processing"
          );
          if (hasActiveProcessing) {
            chat.resumeStream();
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

  const handleCodePanelChange = useCallback(
    (code: string) => {
      setCodePanel((prev) => (prev ? { ...prev, code } : null));
    },
    [],
  );

  function optimisticUpdateTopic(topic: string) {
    if (!isNewSession) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, topic, status: "active" } : s,
      ),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChatError(null);
    if (chat.input.trim()) {
      optimisticUpdateTopic(chat.input.trim());
      chat.handleSubmit(e);
    }
  }

  function handleTopicClick(topic: string) {
    optimisticUpdateTopic(topic);
    chat.submitMessage(topic);
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
    setDiagnosticAnalyzing(true);

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
          messages: [
            ...chat.messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.parts
                  ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("") ?? "",
              })),
            { role: "user" as const, content: hiddenContent },
          ],
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

      setDiagnosticAnalyzing(false);
      setDiagnosticSubmitted(true);
    } catch (err) {
      console.error("Diagnostic submit error:", err);
      setDiagnosticAnalyzing(false);
      setDiagnosticSubmitted(true);
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

  const showRight = nodes.length > 0 || codePanel;

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse-soft rounded-full bg-roadmap-fill" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex h-full items-center justify-center">
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
            onClick={() => navigate("/")}
            className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const chatAreaProps = {
    messages: chat.messages,
    input: chat.input,
    isLoading: chat.isLoading,
    onInputChange: chat.handleInputChange,
    onSubmit: handleSubmit,
    onStop: chat.stop,
    isSuggesting,
    suggestion,
    onSuggest: handleSuggest,
    onApplySuggestion: handleApplySuggestion,
    onDismissSuggestion: handleDismissSuggestion,
    onDiagnosticSubmit: handleDiagnosticSubmit,
    diagnosticSubmitted,
    diagnosticAnalyzing,
    teachingMode,
    onTeachingModeChange: setTeachingMode,
    error: chatError,
    currentModel: llmConfigs.find((c) => c.id === selectedConfigId)?.defaultModel,
    llmConfigs: llmConfigs.map((c) => ({ id: c.id, provider: c.provider, defaultModel: c.defaultModel, isDefault: c.isDefault })),
    selectedConfigId,
    onModelChange: setSelectedConfigId,
    disabled: llmConfigs.length === 0 && !hasEnvConfig,
    masteryTransitionPending,
    nextNodeTitle,
  };

  return (
    <SandboxProvider>
    <div ref={containerRef} className="flex h-full min-w-0">
      <div className="relative flex min-w-0 flex-1 flex-col">
        {showRight && (
          <div className="absolute right-3 top-3 z-10 hidden lg:block">
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="rounded-lg border border-border bg-card p-2 shadow-sm transition-colors hover:bg-secondary"
            >
              {rightCollapsed ? (
                <PanelRightClose className="h-4 w-4 text-foreground" />
              ) : (
                <PanelRight className="h-4 w-4 text-foreground" />
              )}
            </button>
          </div>
        )}
        {isNewSession ? (
          <>
            <ChatArea
              {...chatAreaProps}
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
            <ChatArea {...chatAreaProps} />
            <QuickQuestion sessionId={sessionId} />
          </>
        )}
      </div>

      {showRight && !rightCollapsed && (
        <>
          <ResizableDivider
            direction="horizontal"
            onResize={handleRightResize}
            className="w-px cursor-col-resize border-0 bg-[#1a1d2b]"
          />
          <div
            className="hidden lg:block shrink-0"
            style={{ width: rightWidth }}
          >
            <RightSidebar
              nodes={nodes}
              codePanel={codePanel}
              onCodePanelChange={handleCodePanelChange}
              activeTab={rightTab}
              onTabChange={setRightTab}
            />
          </div>
        </>
      )}
    </div>
    </SandboxProvider>
  );
}
