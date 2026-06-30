import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { ResizableDivider } from "@/components/layout/resizable-divider";
import {
  isAssessmentCardData,
  type AssessmentCardProps,
} from "@/components/chat/assessment-card";
import { ChatArea } from "@/components/chat/chat-area";
import { ChatInput } from "@/components/chat/chat-input";
import { QuickQuestion } from "@/components/chat/quick-question";
import type { TeachingMode } from "@/components/chat/mode-selector";
import type { InteractiveSubmitPayload } from "@/components/ui-blocks/interactive-block";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { MessageMetadata, DiagnosticQuestionsData, AnnotationData } from "@/hooks/use-chat-stream";
import {
  fetchSession,
  fetchSessions,
  getLlmConfigs,
  getEnvStatus,
  createSession,
  type LlmConfig,
} from "@/lib/api-client";
import { useSession } from "@/contexts/session-context";
import { SandboxProvider } from "@/contexts/sandbox-context";
import type { UIMessage } from "ai";
import { GraduationCap, PanelRightClose, MapPin, ArrowRight } from "lucide-react";
import { ModeTabs, type ActiveMode } from "@/components/layout/mode-tabs";

const USER_ID = "seed-user-ai-teacher";
const PENDING_FIRST_USER_ID = "pending-first-user";
const PENDING_FIRST_ASSISTANT_ID = "pending-first-assistant";

const suggestedTopics = [
  { title: "AI 提示词工程", meta: "AI 工具" },
  { title: "用 LangGraph 搭建 AI Agent", meta: "工程实践" },
  { title: "科学减脂与身材管理", meta: "健康生活" },
  { title: "情绪管理与压力释放", meta: "心理成长" },
  { title: "个人投资理财入门", meta: "财商基础" },
  { title: "自媒体运营与个人品牌", meta: "内容增长" },
];

// ─── 壳组件：路由入口，按有无 sessionId 分发引导态/聊天态 ───
export function Component() {
  const { sessionId } = useParams<{ sessionId: string }>();
  // /learn 无 id → LandingView（引导态）；/learn/:id → ChatView（聊天态）
  return sessionId ? <ChatView sessionId={sessionId} /> : <LandingView />;
}

// ─── LandingView：引导态（无 sessionId），居中输入框 + 引导文字，发消息才建会话 ───
function LandingView() {
  const navigate = useNavigate();
  const { sessions, setSessions } = useSession();
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [teachingMode, setTeachingMode] = useState<TeachingMode>("warm");
  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(undefined);
  const [hasEnvConfig, setHasEnvConfig] = useState(true);

  useEffect(() => {
    getLlmConfigs(USER_ID)
      .then((data) => {
        setLlmConfigs(data.configs);
        const def = data.configs.find((c) => c.isDefault) ?? data.configs[0];
        setSelectedConfigId(def?.id);
      })
      .catch(() => setLlmConfigs([]));
    getEnvStatus()
      .then((s) => setHasEnvConfig(s.hasDefaultDbConfig || s.hasEnvConfig))
      .catch(() => setHasEnvConfig(false));
  }, []);

  // 统一包装为「请教我学习《》」；已含书名号或已是学习请求句式则不重复包装
  function formatFirstMessage(text: string): string {
    if (/《.+》/.test(text) || /^(请教|请教我|学习|我想学)/.test(text)) {
      return text;
    }
    return `请教我学习《${text}》。`;
  }

  // 发消息才建会话：输入首条消息 → POST /api/sessions（topic=未命名对话 + teachingMode）拿 id → 跳转带 firstMessage
  // React Router viewTransition：同 view-transition-name 元素（ChatInput）跨路由自动位移插值，输入框从居中下沉到底部。
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    const formatted = formatFirstMessage(trimmed);
    try {
      const newSession = await createSession(USER_ID, "未命名对话", teachingMode, selectedConfigId);
      setSessions((prev) => [newSession, ...prev]);
      const target = `/learn/${newSession.id}`;
      navigate(target, {
        state: { firstMessage: formatted, teachingMode, llmConfigId: selectedConfigId },
        replace: true,
        viewTransition: true,
        flushSync: true,
      });
      setCreating(false);
    } catch (err) {
      console.error("Failed to create session:", err);
      setCreating(false);
    }
  }

  const learningSession = sessions.find(
    (s) => s.status === "active" || s.status === "diagnosing",
  );
  const disabled = llmConfigs.length === 0 && !hasEnvConfig;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl">
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

        <div className="mb-4">
          <ChatInput
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(topic);
            }}
            onStop={() => {}}
            isLoading={creating}
            disabled={disabled}
            teachingMode={teachingMode}
            onTeachingModeChange={setTeachingMode}
            currentModel={llmConfigs.find((c) => c.id === selectedConfigId)?.defaultModel}
            llmConfigs={llmConfigs.map((c) => ({ id: c.id, provider: c.provider, defaultModel: c.defaultModel, isDefault: c.isDefault }))}
            selectedConfigId={selectedConfigId}
            onModelChange={setSelectedConfigId}
            frameless
          />
        </div>

        <div
          data-testid="suggested-topic-grid"
          className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {suggestedTopics.map((t) => (
            <button
              key={t.title}
              onClick={() => sendMessage(t.title)}
              disabled={creating}
              data-testid="suggested-topic-card"
              className="group min-h-20 rounded-lg border border-border bg-card/70 px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-secondary hover:shadow-md disabled:opacity-40"
            >
              <span className="text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
                {t.meta}
              </span>
              <span className="mt-1 block text-sm font-medium leading-snug text-foreground">
                {t.title}
              </span>
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

        {/* 三阶段闭环示意 */}
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

function hasToolResult(metadata: unknown, toolName: string): boolean {
  if (!isObject(metadata) || !Array.isArray(metadata.toolResults)) {
    return false;
  }

  return metadata.toolResults.some(
    (toolResult) => isObject(toolResult) && toolResult.toolName === toolName,
  );
}

function shouldHideLegacyDiagnosticRoadmapMessage(message: {
  role: string;
  metadata: unknown;
}) {
  if (message.role !== "tutor") return false;
  return (
    hasToolResult(message.metadata, "generateRoadmap") &&
    hasToolResult(message.metadata, "askQuestion")
  );
}

// ─── ChatView：聊天态（有 sessionId），现有 learn 主体逻辑 ───
function ChatView({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const { setSessions, refreshSessions } = useSession();
  const location = useLocation();

  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const prevSessionRef = useRef<string | null>(null);
  const [teachingMode, setTeachingMode] = useState<"warm" | "strict">(
    () => (location.state as { teachingMode?: "warm" | "strict" } | null)?.teachingMode ?? "warm",
  );
  const [chatError, setChatError] = useState<string | null>(null);
  const [diagnosticSubmitted, setDiagnosticSubmitted] = useState(false);
  const [diagnosticAnalyzing, setDiagnosticAnalyzing] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [firstLessonPreparing, setFirstLessonPreparing] = useState(false);
  const [interactiveResponding, setInteractiveResponding] = useState(false);

  const [masteryTransitionPending, setMasteryTransitionPending] = useState(false);
  const [nextNodeTitle, setNextNodeTitle] = useState<string | undefined>(undefined);
  const streamErrorRef = useRef(false);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined);

  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(
    () => (location.state as { llmConfigId?: string } | null)?.llmConfigId,
  );
  const [hasEnvConfig, setHasEnvConfig] = useState(true);

  const [codePanel, setCodePanel] = useState<{
    code: string;
    language: string;
    instruction?: string;
  } | null>(null);

  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightTab, setRightTab] = useState<"roadmap" | "code">("roadmap");
  const [activeMode, setActiveMode] = useState<ActiveMode>("learning");
  // 落地页发首条消息后传入：新会话进入时立即发起 chat 流（首条即触发诊断），无空态闪烁
  const [firstMessage, setFirstMessage] = useState<string | undefined>(
    () => (location.state as { firstMessage?: string } | null)?.firstMessage,
  );
  // 首条消息待发送标志：抑制 ChatArea 空态 fallback，避免「开始你的学习之旅吧」闪烁
  const [pendingFirstMessage, setPendingFirstMessage] = useState(
    () => !!(location.state as { firstMessage?: string } | null)?.firstMessage,
  );
  const pendingFirstMessages = useMemo<UIMessage<MessageMetadata>[]>(
    () =>
      pendingFirstMessage && firstMessage
        ? [
            {
              id: PENDING_FIRST_USER_ID,
              role: "user",
              parts: [{ type: "text" as const, text: firstMessage }],
            },
            {
              id: PENDING_FIRST_ASSISTANT_ID,
              role: "assistant",
              parts: [{ type: "text" as const, text: "" }],
              metadata: { annotations: [] },
            },
          ]
        : [],
    [firstMessage, pendingFirstMessage],
  );
  const [reviewDueNodes, setReviewDueNodes] = useState<Array<{
    id: string;
    index: number;
    title: string;
    memoryStrength: number;
    isOverdue: boolean;
  }>>([]);
  const [interviewResult, setInterviewResult] = useState<{
    status: "in_progress" | "completed";
    totalScore: number;
    difficulty: "easy" | "medium" | "hard";
    questionCount: number;
  } | null>(null);
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
      setFirstLessonPreparing(false);
      setInteractiveResponding(false);
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
      setFirstLessonPreparing(false);
      setInteractiveResponding(false);
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
    onTitleUpdate: (title) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, topic: title } : s)),
      );
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
      setFirstLessonPreparing(false);
      setInteractiveResponding(false);
      setMasteryTransitionPending(false);
      setNextNodeTitle(undefined);
      streamErrorRef.current = false;
      setSuggestion(undefined);
      setActiveMode("learning");
      setReviewDueNodes([]);
      setInterviewResult(null);
      setRightTab("roadmap");
      setFirstMessage(undefined);
      setPendingFirstMessage(false);
    }
    prevSessionRef.current = sessionId;

    // 拉取今日复习到期清单（有 mastered 节点时）
    fetchReviewDue();
    // 拉取最新面试结果（评分卡/复盘）
    fetchInterviewResult();

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
                  currentNodeId: fetchedNodes.find((n: NodeInfo) => n.status === "in_progress")?.id ?? null,
                },
              };
              setSessions([virtualSession, ...sessionsList]);
              setNodes(fetchedNodes);
              const hasVisibleMessages = sessionData.session.messages.some(
                (m) =>
                  (m.role === "learner" || m.role === "tutor") &&
                  !m.hidden &&
                  !shouldHideLegacyDiagnosticRoadmapMessage(m),
              );
              setIsNewSession(!hasVisibleMessages);
              if (hasVisibleMessages) {
                setPendingFirstMessage(false);
                setFirstMessage(undefined);
              }
            } else {
              // session 不存在（DB 也无）—— 改造后落地页已先建，此处为异常路径
              // 不再创建空占位会话，显示错误提示
              setPageError("会话不存在，请返回首页重新开始");
              setSessions(sessionsList);
            }
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
          const loadedNodes = sessionData.session.roadmap?.nodes ?? [];
          setNodes(loadedNodes);
          // isNewSession 判定：无可见消息（落地页刚建的空会话）→ true，触发首屏 + 自动诊断
          const hasVisibleMessages = sessionData.session.messages.some(
            (m) =>
              (m.role === "learner" || m.role === "tutor") &&
              !m.hidden &&
              !shouldHideLegacyDiagnosticRoadmapMessage(m),
          );
          setIsNewSession(!hasVisibleMessages);
          setSelectedConfigId((sessionData.session as Record<string, unknown>).llmConfigId as string | undefined);
          setActiveMode(sessionData.session.activeMode);

          if (loadedNodes.length > 0) {
            setDiagnosticSubmitted(true);
          }

          const historyMessages: UIMessage<MessageMetadata>[] = sessionData.session.messages
            .filter(
              (m) =>
                (m.role === "learner" || m.role === "tutor") &&
                !m.hidden &&
                !shouldHideLegacyDiagnosticRoadmapMessage(m),
            )
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
          if (historyMessages.length > 0 || !pendingFirstMessage) {
            chat.setMessages(historyMessages);
          }
          if (historyMessages.length > 0) {
            setPendingFirstMessage(false);
            setFirstMessage(undefined);
          }

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

  // 复习模式：拉取今日到期清单（spec §3.1）
  const fetchReviewDue = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/review/due`);
      if (!res.ok) return;
      const data = await res.json();
      setReviewDueNodes(data.dueNodes ?? []);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  // 开始复习：切 activeMode=review + 发消息触发考官 agent
  async function handleStartReview() {
    if (!sessionId) return;
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeMode: "review" }),
      });
      setActiveMode("review");
      chat.submitMessage("开始复习吧");
    } catch {
      /* ignore */
    }
  }

  // 面试模式：拉取最新面试结果（评分卡/复盘，spec §4）
  const fetchInterviewResult = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/interview/result`);
      if (!res.ok) return;
      const data = await res.json();
      const r = data.result;
      if (!r) {
        setInterviewResult(null);
        return;
      }
      const log = (r.questionLog ?? []) as unknown[];
      setInterviewResult({
        status: r.status,
        totalScore: r.totalScore ?? 0,
        difficulty: r.difficulty ?? "medium",
        questionCount: log.length,
      });
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  // 开始面试：切 activeMode=interview + 发消息触发面试官 agent
  async function handleStartInterview() {
    if (!sessionId) return;
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeMode: "interview" }),
      });
      setActiveMode("interview");
      chat.submitMessage("开始面试吧");
    } catch {
      /* ignore */
    }
  }

  // 顶部 Tab 切模式（spec §5.1）：切 activeMode + 触发对应模式首轮；切回 learning 不发消息
  async function handleModeChange(mode: ActiveMode) {
    if (mode === activeMode) return;
    // 乐观更新左栏模式图标（spec §5.3③）
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, activeMode: mode } : s)));
    if (mode === "review") {
      handleStartReview();
    } else if (mode === "interview") {
      handleStartInterview();
    } else {
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeMode: "learning" }),
        });
        setActiveMode("learning");
      } catch {
        /* ignore */
      }
    }
  }

  // 抽认卡自评事件：POST /review/result 更新记忆强度 + 发消息推进对话（spec §3.2/§3.3）
  useEffect(() => {
    if (!sessionId) return;
    const handler = async (e: Event) => {
      const { nodeId, correct } = (e as CustomEvent<{ nodeId: string; correct: boolean }>).detail;
      try {
        await fetch(`/api/sessions/${sessionId}/review/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, correct }),
        });
      } catch {
        /* ignore */
      }
      chat.submitMessage(correct ? "答对" : "答错");
      // 刷新到期清单（已答项移出）
      fetchReviewDue();
    };
    window.addEventListener("review-flashcard-answer", handler);
    return () => window.removeEventListener("review-flashcard-answer", handler);
  }, [sessionId, chat, fetchReviewDue]);

  // 面试模式：每轮对话后刷新面试结果（scoreAnswer/finalizeInterview 可能已更新，spec §4）
  useEffect(() => {
    if (activeMode !== "interview" || !sessionId) return;
    fetchInterviewResult();
  }, [activeMode, sessionId, chat.messages, fetchInterviewResult]);

  // 落地页发首条消息后自动接续流：新会话且带 firstMessage 时立即发起 chat 流
  // submitMessage 同步 setMessages（user+assistant），messages 立即非空，空态 fallback 不触发
  useEffect(() => {
    if (!isNewSession || !firstMessage || chat.isLoading) return;
    if (chat.messages.length > 0) {
      setFirstMessage(undefined);
      setPendingFirstMessage(false);
      return;
    }
    chat.submitMessage(firstMessage, {
      userId: PENDING_FIRST_USER_ID,
      assistantId: PENDING_FIRST_ASSISTANT_ID,
    });
    setFirstMessage(undefined);
    setPendingFirstMessage(false);
  }, [isNewSession, firstMessage, chat.isLoading, chat.messages.length]);

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
    setDiagnosticAnalyzing(true);
    setDiagnosticError(null);

    const answerLines = answers.map(
      (a) => `${a.questionId}: ${a.optionId} (${a.optionText})`,
    );
    const hiddenContent = `[Quiz Response] ${answerLines.join(" | ")}`;

    let roadmapGenerated = false;
    let firstNodeTitle: string | undefined;

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

      const reader = postRes.body?.getReader();
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

            let event: { type: string; content?: string; data?: unknown; message?: string };
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (event.type === "tool-result" && event.data) {
              const data = event.data as {
                toolName?: string;
                result?: {
                  success?: boolean;
                  error?: string;
                  firstNode?: { title?: string };
                  roadmapUpdate?: { nodes?: NodeInfo[] };
                  sessionUpdate?: { masteredNodes?: number; totalNodes?: number };
                };
              };
              if (data.toolName === "generateRoadmap") {
                const result = data.result;
                if (result && result.success === false) {
                  setDiagnosticError(result.error ?? "路线图生成失败，请重试");
                  setDiagnosticAnalyzing(false);
                  setDiagnosticSubmitted(true);
                  return;
                }
                if (
                  result?.success !== false &&
                  Array.isArray(result?.roadmapUpdate?.nodes) &&
                  result.roadmapUpdate.nodes.length > 0
                ) {
                  roadmapGenerated = true;
                  setNodes(result.roadmapUpdate.nodes);
                  firstNodeTitle = result.firstNode?.title ?? firstNodeTitle;
                  if (result.sessionUpdate?.totalNodes !== undefined) {
                    const sessionUpdate = result.sessionUpdate;
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === sessionId
                          ? {
                              ...s,
                              progress: {
                                ...s.progress,
                                totalNodes: sessionUpdate.totalNodes!,
                                masteredNodes: sessionUpdate.masteredNodes ?? 0,
                              },
                            }
                          : s,
                      ),
                    );
                  }
                }
              }
            }

            if (event.type === "roadmap-updated" && event.data) {
              const data = event.data as { nodes: NodeInfo[] };
              if (data.nodes && data.nodes.length > 0) {
                roadmapGenerated = true;
                setNodes(data.nodes);
                firstNodeTitle =
                  data.nodes.find((node) => node.status === "in_progress")?.title ??
                  data.nodes[0]?.title ??
                  firstNodeTitle;
              }
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

            if (event.type === "error") {
              throw new Error(event.message ?? "诊断分析失败，请稍后重试");
            }
          }
        }
      }

      setDiagnosticAnalyzing(false);
      setDiagnosticSubmitted(true);
      if (roadmapGenerated) {
        setFirstLessonPreparing(true);
        chat.submitHiddenMessage(
          `[Continue] 开始教学知识点：${firstNodeTitle ?? "第一个知识点"}`,
          { assistantId: `assistant-first-lesson-${Date.now()}` },
        );
      }
    } catch (err) {
      console.error("Diagnostic submit error:", err);
      setDiagnosticAnalyzing(false);
      setFirstLessonPreparing(false);
      setDiagnosticSubmitted(true);
      setChatError(err instanceof Error ? err.message : "诊断分析失败，请稍后重试");
      setTimeout(() => setChatError(null), 5000);
    }

    fetchSession(sessionId)
      .then((data) => {
        if (data) {
          const fetchedNodes = data.session.roadmap?.nodes ?? [];
          if (fetchedNodes.length > 0) {
            setNodes(fetchedNodes);
          } else if (roadmapGenerated) {
            setTimeout(() => {
              fetchSession(sessionId)
                .then((d) => {
                  if (d?.session.roadmap?.nodes?.length) {
                    setNodes(d.session.roadmap.nodes);
                  }
                })
                .catch(console.error);
            }, 500);
          }
        }
        return fetchSessions(USER_ID);
      })
      .then((data) => {
        if (data) setSessions(data.sessions);
      })
      .catch(console.error);
  }

  function handleInteractiveSubmit(payload: InteractiveSubmitPayload) {
    // 重复提交由卡片自身 submitted 态 + interactiveResponding 双重拦截。
    // 不再用 chat.isLoading 拦截——它会吞掉首轮合法提交（提交后流未结束前的正常等待被误判）。
    if (interactiveResponding) return;
    const answer = payload.answer ? `答案：${payload.answer}` : "用户已完成互动课自测";
    const feedback = payload.feedback ? `；互动反馈：${payload.feedback}` : "";
    setInteractiveResponding(true);
    chat.submitHiddenMessage(
      `[Interactive Response] ${answer}${feedback}`,
      { assistantId: `assistant-interactive-${Date.now()}` },
    );
  }

  const chatAreaProps = {
    messages: pendingFirstMessage ? pendingFirstMessages : chat.messages,
    input: chat.input,
    isLoading: pendingFirstMessage || chat.isLoading,
    onInputChange: chat.handleInputChange,
    onSubmit: handleSubmit,
    onStop: chat.stop,
    isSuggesting,
    suggestion,
    onSuggest: handleSuggest,
    onApplySuggestion: handleApplySuggestion,
    onDismissSuggestion: handleDismissSuggestion,
    onDiagnosticSubmit: handleDiagnosticSubmit,
    onInteractiveSubmit: handleInteractiveSubmit,
    loadingLabelOverride: firstLessonPreparing
      ? "路线已生成，正在准备第一节互动练习…"
      : interactiveResponding
        ? "老师正在根据你的互动结果继续…"
        : undefined,
    diagnosticSubmitted,
    diagnosticAnalyzing,
    teachingMode,
    onTeachingModeChange: setTeachingMode,
    error: diagnosticError ?? chatError,
    currentModel: llmConfigs.find((c) => c.id === selectedConfigId)?.defaultModel,
    llmConfigs: llmConfigs.map((c) => ({ id: c.id, provider: c.provider, defaultModel: c.defaultModel, isDefault: c.isDefault })),
    selectedConfigId,
    onModelChange: setSelectedConfigId,
    disabled: llmConfigs.length === 0 && !hasEnvConfig,
    masteryTransitionPending,
    nextNodeTitle,
  };

  const showRight = nodes.length > 0 || codePanel;

  if (!loaded && !pendingFirstMessage) {
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
            onClick={() => navigate("/learn")}
            className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <SandboxProvider>
    <div ref={containerRef} className="flex h-full min-w-0">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {showRight && (
          <div className="absolute right-3 top-3 z-10 hidden lg:block">
            {rightCollapsed ? (
              <button
                onClick={() => setRightCollapsed(false)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>路线 {nodes.filter((n) => n.status === "mastered").length}/{nodes.length}</span>
              </button>
            ) : (
              <button
                onClick={() => setRightCollapsed(true)}
                className="rounded-lg border border-border bg-card p-2 shadow-sm transition-colors hover:bg-secondary"
              >
                <PanelRightClose className="h-4 w-4 text-foreground" />
              </button>
            )}
          </div>
        )}
        <ModeTabs
          activeMode={activeMode}
          masteredCount={nodes.filter((n) => n.status === "mastered").length}
          onChange={handleModeChange}
        />
        <ChatArea
          {...chatAreaProps}
          welcomeContent={
            pendingFirstMessage ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-chat-thinking" style={{ animation: "pulse-dot 1.4s ease-in-out infinite", animationDelay: "0s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-chat-thinking" style={{ animation: "pulse-dot 1.4s ease-in-out infinite", animationDelay: "0.2s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-chat-thinking" style={{ animation: "pulse-dot 1.4s ease-in-out infinite", animationDelay: "0.4s" }} />
                </div>
                <p className="text-sm">正在发送…</p>
              </div>
            ) : undefined
          }
        />
        <QuickQuestion sessionId={sessionId} />
      </div>

      {showRight && !rightCollapsed && (
        <>
          <ResizableDivider
            direction="horizontal"
            onResize={handleRightResize}
            className="w-px cursor-col-resize border-0 bg-border/40 hover:bg-primary/30"
          />
          <div
            className="hidden lg:block shrink-0"
            style={{ width: rightWidth }}
          >
            <RightSidebar
              nodes={nodes}
              activeMode={activeMode}
              codePanel={codePanel}
              onCodePanelChange={handleCodePanelChange}
              activeTab={rightTab}
              onTabChange={setRightTab}
              reviewDueNodes={reviewDueNodes}
              onStartReview={handleStartReview}
              reviewActive={activeMode === "review"}
              interviewResult={interviewResult}
              onStartInterview={handleStartInterview}
              interviewActive={activeMode === "interview"}
            />
          </div>
        </>
      )}
    </div>
    </SandboxProvider>
  );
}
