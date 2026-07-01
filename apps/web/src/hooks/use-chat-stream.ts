import { useState, useCallback, useRef, useEffect } from "react";
import type { UIMessage } from "ai";
import { parseSSEEvent, SSEEventType, type SSEEvent } from "@ai-teacher/shared";
import {
  INITIAL_TOKEN_USAGE,
  mergeUsage,
  type TokenUsage,
  type UsageEventData,
} from "@/lib/usage-metrics";

export type { TokenUsage } from "@/lib/usage-metrics";

interface UseChatStreamOptions {
  teachingMode?: "warm" | "strict";
  llmConfigId?: string;
  onFinish?: () => void;
  onError?: (error: string) => void;
  onRoadmapUpdate?: (nodes: unknown[]) => void;
  onSessionUpdate?: (data: {
    masteredNodes?: number;
    totalNodes?: number;
    title?: string;
    learningStatus?: string;
  }) => void;
  /** Fires when a node mastery transition is detected (assessMastery triggered roadmap-updated) */
  onMasteryTransition?: (nextNodeTitle?: string) => void;
  /** Fires when worker generates a session title from the first message */
  onTitleUpdate?: (title: string) => void;
}

interface SubmitOptions {
  hidden?: boolean;
  showUser?: boolean;
  requestMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface DiagnosticQuestionsData {
  questions: Array<{
    id: string;
    question: string;
    title: string;
    options: Array<{ id: string; text: string }>;
  }>;
  question: string;
  nodeId: string;
}

export interface LoopTraceStep {
  step: number;
  total: number;
  t0: number;
  durationMs?: number;
  reasoning?: string;
  tools?: Array<{ name: string }>;
}

export interface LoopTrace {
  steps: LoopTraceStep[];
  failovers?: Array<{ from: string; to: string; reason: string; step: number }>;
  loopWarnings?: Array<{ type: string; toolName: string; step: number }>;
}

export interface AnnotationData {
  toolName?: string;
  args?: unknown;
  result?: unknown;
  uiBlocks?: unknown[];
  streamingBlocks?: boolean;
  codePush?: { code: string; language: string; instruction?: string };
  diagnosticQuestions?: DiagnosticQuestionsData;
  roadmapUpdate?: { nodes: unknown[] };
  sessionUpdate?: {
    masteredNodes?: number;
    totalNodes?: number;
    title?: string;
    learningStatus?: string;
  };
  loopTrace?: LoopTrace;
}

export interface MessageMetadata {
  annotations?: AnnotationData[];
}

export interface ContextInfo {
  estimatedHistoryTokens: number;
  compactionBudget: number;
  needsCompaction: boolean;
}

// 单条 annotation 里承载 loopTrace（单对象，非数组）。updater 对该对象做就地变更，
// 若不存在则新建。返回新的 annotations 数组（不可变更新）。
function updateLoopTrace(
  annotations: AnnotationData[],
  updater: (trace: LoopTrace) => LoopTrace,
): AnnotationData[] {
  const idx = annotations.findIndex(
    (a) => a && "loopTrace" in a && a.loopTrace,
  );
  if (idx === -1) {
    const fresh: LoopTrace = { steps: [] };
    const next = updater(fresh);
    return [...annotations, { loopTrace: next }];
  }
  const updated = [...annotations];
  const current = (annotations[idx].loopTrace as LoopTrace) ?? { steps: [] };
  updated[idx] = { ...annotations[idx], loopTrace: updater(current) };
  return updated;
}

// 把工具名追加到 loopTrace 最近一步的 tools（无 step 时静默）
function appendToolToLastStep(
  annotations: AnnotationData[],
  toolName: string,
): AnnotationData[] {
  return updateLoopTrace(annotations, (trace) => {
    if (trace.steps.length === 0) return trace;
    const lastIdx = trace.steps.length - 1;
    const last = trace.steps[lastIdx];
    const tools = [...(last.tools ?? []), { name: toolName }];
    const steps = [...trace.steps];
    steps[lastIdx] = { ...last, tools };
    return { ...trace, steps };
  });
}

function getTextFromParts(parts: UIMessage["parts"]): string {
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function useChatStream(
  sessionId: string,
  options?: UseChatStreamOptions,
) {
  const [messages, setMessages] = useState<UIMessage<MessageMetadata>[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>(INITIAL_TOKEN_USAGE);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTokenUsage(INITIAL_TOKEN_USAGE);
    setContextInfo(null);
  }, [sessionId]);

  // Cleanup: abort any in-flight SSE stream when component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const handleInputChange = useCallback(
    (
      e:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      setInput(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (
      e?: React.FormEvent,
      overrideText?: string,
      optimisticIds?: { userId?: string; assistantId?: string },
      submitOptions?: SubmitOptions,
    ) => {
      e?.preventDefault();
      const text = overrideText ?? input;
      if (!text.trim() || isLoading) return;
      const showUser = submitOptions?.showUser ?? true;

      const userMessage: UIMessage<MessageMetadata> = {
        id: optimisticIds?.userId ?? `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text" as const, text: text.trim() }],
      };

      const assistantMessage: UIMessage<MessageMetadata> = {
        id: optimisticIds?.assistantId ?? `assistant-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text" as const, text: "" }],
        metadata: { annotations: [] },
      };

      const newMessages = [
        ...messages,
        ...(showUser ? [userMessage] : []),
        assistantMessage,
      ];
      setMessages(newMessages);
      if (showUser) {
        setInput("");
      }
      setIsLoading(true);

      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const postRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            messages: submitOptions?.requestMessages ?? [
              ...messages.map((m) => ({
                role: m.role,
                content: getTextFromParts(m.parts),
              })),
              { role: "user" as const, content: text.trim() },
            ],
            ...(submitOptions?.hidden ? { hidden: true } : {}),
            ...(options?.teachingMode
              ? { teachingMode: options.teachingMode }
              : {}),
            ...(options?.llmConfigId
              ? { llmConfigId: options.llmConfigId }
              : {}),
          }),
          signal: controller.signal,
        });

        if (!postRes.ok) {
          throw new Error(`Failed to send message: ${postRes.status}`);
        }

        const reader = postRes.body?.getReader();
        if (!reader) throw new Error("No stream body");

        const decoder = new TextDecoder();
        let buffer = "";
        let textFrozen = false;
        let masteryDetected = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE format: events separated by double newlines
          // Each event line starts with "data: "
          const sseParts = buffer.split("\n\n");
          buffer = sseParts.pop() || ""; // Keep potentially incomplete event in buffer

          for (const part of sseParts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              let event: SSEEvent | null;
              try {
                event = parseSSEEvent(JSON.parse(jsonStr));
              } catch {
                continue;
              }
              if (!event) continue;

              const assistantIdx = newMessages.length - 1;

              if (
                event.type === SSEEventType.TextDelta &&
                typeof event.content === "string"
              ) {
                if (textFrozen) continue;
                const prevText = getTextFromParts(
                  newMessages[assistantIdx].parts,
                );
                const updatedText = prevText + event.content;
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: [{ type: "text" as const, text: updatedText }],
                };
                setMessages([...newMessages]);
              } else if (event.type === SSEEventType.ToolCall && event.data) {
                const data = event.data as Record<string, unknown>;
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                const toolName = String(data.toolName);
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: appendToolToLastStep(
                      [...existing, { toolName, args: data.args }],
                      toolName,
                    ),
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === SSEEventType.ToolResult && event.data) {
                const data = event.data as Record<string, unknown>;
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                const toolName = String(data.toolName);
                if (toolName === "assessMastery") {
                  const result = data.result as
                    | Record<string, unknown>
                    | undefined;
                  if (result?.roadmapUpdate) {
                    masteryDetected = true;
                  }
                }
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [
                      ...existing,
                      { toolName, result: data.result },
                    ],
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === SSEEventType.UiStreamStart) {
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [
                      ...existing,
                      { streamingBlocks: true, uiBlocks: [] },
                    ],
                  },
                };
                setMessages([...newMessages]);
              } else if (
                event.type === SSEEventType.UiBlockDelta &&
                event.data
              ) {
                const data = event.data as { block: unknown; index: number };
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                let streamIdx = -1;
                for (let j = existing.length - 1; j >= 0; j--) {
                  if (
                    (existing[j] as AnnotationData).streamingBlocks === true
                  ) {
                    streamIdx = j;
                    break;
                  }
                }
                if (streamIdx !== -1) {
                  const streamAnno = existing[streamIdx] as AnnotationData;
                  const blocks = [...(streamAnno.uiBlocks ?? []), data.block];
                  const updated = [...existing];
                  updated[streamIdx] = { ...streamAnno, uiBlocks: blocks };
                  newMessages[assistantIdx] = {
                    ...newMessages[assistantIdx],
                    parts: newMessages[assistantIdx].parts,
                    metadata: {
                      ...newMessages[assistantIdx].metadata,
                      annotations: updated,
                    },
                  };
                  setMessages([...newMessages]);
                }
              } else if (event.type === SSEEventType.UiBlocks && event.data) {
                const data = event.data as { uiBlocks: unknown[] };
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                let streamIdx = -1;
                for (let j = existing.length - 1; j >= 0; j--) {
                  if (
                    (existing[j] as AnnotationData).streamingBlocks === true
                  ) {
                    streamIdx = j;
                    break;
                  }
                }
                if (streamIdx !== -1) {
                  const updated = [...existing];
                  updated[streamIdx] = { uiBlocks: data.uiBlocks };
                  newMessages[assistantIdx] = {
                    ...newMessages[assistantIdx],
                    parts: newMessages[assistantIdx].parts,
                    metadata: {
                      ...newMessages[assistantIdx].metadata,
                      annotations: updated,
                    },
                  };
                } else {
                  newMessages[assistantIdx] = {
                    ...newMessages[assistantIdx],
                    parts: newMessages[assistantIdx].parts,
                    metadata: {
                      ...newMessages[assistantIdx].metadata,
                      annotations: [...existing, { uiBlocks: data.uiBlocks }],
                    },
                  };
                }
                setMessages([...newMessages]);
              } else if (event.type === SSEEventType.CodePush && event.data) {
                const data = event.data as {
                  code: string;
                  language: string;
                  instruction?: string;
                };
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [...existing, { codePush: data }],
                  },
                };
                setMessages([...newMessages]);
              } else if (
                event.type === SSEEventType.AskQuestion &&
                event.data
              ) {
                textFrozen = true;
                const data = event.data as {
                  questions: unknown[];
                  question: string;
                  nodeId: string;
                };
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [
                      ...existing,
                      {
                        diagnosticQuestions: {
                          questions:
                            data.questions as DiagnosticQuestionsData["questions"],
                          question: data.question,
                          nodeId: data.nodeId,
                        },
                      },
                    ],
                  },
                };
                setMessages([...newMessages]);
              } else if (
                event.type === SSEEventType.RoadmapUpdated &&
                event.data
              ) {
                const data = event.data as { nodes: unknown[] };
                options?.onRoadmapUpdate?.(data.nodes);
                if (masteryDetected) {
                  const nodesArr = data.nodes as Array<{
                    status: string;
                    title: string;
                  }>;
                  const nextInProgress = nodesArr.find(
                    (n) => n.status === "in_progress",
                  );
                  options?.onMasteryTransition?.(nextInProgress?.title);
                  masteryDetected = false;
                }
              } else if (
                event.type === SSEEventType.SessionUpdated &&
                event.data
              ) {
                const data = event.data as {
                  masteredNodes?: number;
                  totalNodes?: number;
                  title?: string;
                  learningStatus?: string;
                };
                options?.onSessionUpdate?.(data);
              } else if (
                event.type === SSEEventType.TitleUpdated &&
                event.data
              ) {
                const data = event.data as { title?: string };
                if (data.title) options?.onTitleUpdate?.(data.title);
              } else if (event.type === SSEEventType.StepStart && event.data) {
                const data = event.data as { step: number; total: number };
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: updateLoopTrace(existing, (trace) => ({
                      ...trace,
                      steps: [
                        ...trace.steps,
                        {
                          step: Number(data.step),
                          total: Number(data.total),
                          t0: Date.now(),
                        },
                      ],
                    })),
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === SSEEventType.StepEnd && event.data) {
                const data = event.data as {
                  step: number;
                  durationMs?: number;
                };
                const stepNum = Number(data.step);
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: updateLoopTrace(existing, (trace) => ({
                      ...trace,
                      steps: trace.steps.map((s) =>
                        s.step === stepNum
                          ? {
                              ...s,
                              durationMs: data.durationMs ?? Date.now() - s.t0,
                            }
                          : s,
                      ),
                    })),
                  },
                };
                setMessages([...newMessages]);
              } else if (
                event.type === SSEEventType.ReasoningDelta &&
                event.data
              ) {
                const data = event.data as { step: number; text: string };
                const stepNum = Number(data.step);
                const delta = String(data.text ?? "");
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: updateLoopTrace(existing, (trace) => ({
                      ...trace,
                      steps: trace.steps.map((s) =>
                        s.step === stepNum
                          ? { ...s, reasoning: (s.reasoning ?? "") + delta }
                          : s,
                      ),
                    })),
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === SSEEventType.Failover && event.data) {
                const data = event.data as {
                  from: string;
                  to: string;
                  reason: string;
                  step: number;
                };
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: updateLoopTrace(existing, (trace) => ({
                      ...trace,
                      failovers: [
                        ...(trace.failovers ?? []),
                        {
                          from: String(data.from),
                          to: String(data.to),
                          reason: String(data.reason ?? ""),
                          step: Number(data.step),
                        },
                      ],
                    })),
                  },
                };
                setMessages([...newMessages]);
              } else if (
                event.type === SSEEventType.LoopWarning &&
                event.data
              ) {
                const data = event.data as {
                  type: string;
                  toolName: string;
                  step: number;
                };
                const existing =
                  newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: updateLoopTrace(existing, (trace) => ({
                      ...trace,
                      loopWarnings: [
                        ...(trace.loopWarnings ?? []),
                        {
                          type: String(data.type ?? ""),
                          toolName: String(data.toolName ?? ""),
                          step: Number(data.step),
                        },
                      ],
                    })),
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === SSEEventType.Usage && event.data) {
                const usageEvent = event.data as UsageEventData;
                if (usageEvent.usage) {
                  setTokenUsage((prev) => mergeUsage(prev, usageEvent));
                }
              } else if (
                event.type === SSEEventType.ContextInfo &&
                event.data
              ) {
                setContextInfo(event.data as ContextInfo);
              } else if (event.type === SSEEventType.Error) {
                const errorMsg =
                  typeof event.data === "string"
                    ? event.data
                    : ((event.data as Record<string, unknown>)?.message ??
                      "AI 服务异常，请稍后重试");
                console.error("SSE error:", errorMsg);
                options?.onError?.(String(errorMsg));
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // intentional — user stopped generation
        } else {
          const errorMsg = (err as Error).message || "发送消息失败";
          console.error("Chat stream error:", err);
          options?.onError?.(errorMsg);
        }
      } finally {
        setIsLoading(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        options?.onFinish?.();
      }
    },
    [input, isLoading, messages, sessionId, options],
  );

  const stop = useCallback(async () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    try {
      await fetch(`/api/chat/${sessionId}/abort`, { method: "POST" });
    } catch {
      /* ignore — best-effort abort notification */
    }
  }, [sessionId]);

  const submitMessage = useCallback(
    (
      text: string,
      optimisticIds?: { userId?: string; assistantId?: string },
    ) => {
      handleSubmit(undefined, text, optimisticIds);
    },
    [handleSubmit],
  );

  const submitHiddenMessage = useCallback(
    (text: string, optimisticIds?: { assistantId?: string }) => {
      return handleSubmit(
        undefined,
        text,
        { assistantId: optimisticIds?.assistantId },
        {
          hidden: true,
          showUser: false,
          requestMessages: [{ role: "user", content: text.trim() }],
        },
      );
    },
    [handleSubmit],
  );

  const resumeStream = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const sseRes = await fetch(`/api/chat/${sessionId}/stream`, {
        signal: controller.signal,
      });

      if (!sseRes.ok) {
        setIsLoading(false);
        return;
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !getTextFromParts(last.parts)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `assistant-resume-${Date.now()}`,
            role: "assistant" as const,
            parts: [{ type: "text" as const, text: "" }],
            metadata: { annotations: [] },
          },
        ];
      });

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

            let event: SSEEvent | null;
            try {
              event = parseSSEEvent(JSON.parse(jsonStr));
            } catch {
              continue;
            }
            if (!event) continue;

            if (
              event.type === SSEEventType.TextDelta &&
              typeof event.content === "string"
            ) {
              const delta = event.content;
              setMessages((prev) => {
                const idx = prev.length - 1;
                const prevText = getTextFromParts(prev[idx].parts);
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    parts: [{ type: "text" as const, text: prevText + delta }],
                  },
                ];
              });
            } else if (event.type === SSEEventType.ToolCall && event.data) {
              const data = event.data as Record<string, unknown>;
              const toolName = String(data.toolName);
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: appendToolToLastStep(
                        [...existing, { toolName, args: data.args }],
                        toolName,
                      ),
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.ToolResult && event.data) {
              const data = event.data as Record<string, unknown>;
              const toolName = String(data.toolName);
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: [
                        ...existing,
                        { toolName, result: data.result },
                      ],
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.UiStreamStart) {
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: [
                        ...existing,
                        { streamingBlocks: true, uiBlocks: [] },
                      ],
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.UiBlockDelta && event.data) {
              const data = event.data as { block: unknown; index: number };
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                let streamIdx = -1;
                for (let j = existing.length - 1; j >= 0; j--) {
                  if (
                    (existing[j] as AnnotationData).streamingBlocks === true
                  ) {
                    streamIdx = j;
                    break;
                  }
                }
                if (streamIdx === -1) return prev;
                const streamAnno = existing[streamIdx] as AnnotationData;
                const blocks = [...(streamAnno.uiBlocks ?? []), data.block];
                const updated = [...existing];
                updated[streamIdx] = { ...streamAnno, uiBlocks: blocks };
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: { ...prev[idx].metadata, annotations: updated },
                  },
                ];
              });
            } else if (event.type === SSEEventType.UiBlocks && event.data) {
              const data = event.data as { uiBlocks: unknown[] };
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                let streamIdx = -1;
                for (let j = existing.length - 1; j >= 0; j--) {
                  if (
                    (existing[j] as AnnotationData).streamingBlocks === true
                  ) {
                    streamIdx = j;
                    break;
                  }
                }
                if (streamIdx !== -1) {
                  const updated = [...existing];
                  updated[streamIdx] = { uiBlocks: data.uiBlocks };
                  return [
                    ...prev.slice(0, idx),
                    {
                      ...prev[idx],
                      metadata: { ...prev[idx].metadata, annotations: updated },
                    },
                  ];
                }
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: [...existing, { uiBlocks: data.uiBlocks }],
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.CodePush && event.data) {
              const data = event.data as {
                code: string;
                language: string;
                instruction?: string;
              };
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: [...existing, { codePush: data }],
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.AskQuestion && event.data) {
              const data = event.data as {
                questions: unknown[];
                question: string;
                nodeId: string;
              };
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: [
                        ...existing,
                        {
                          diagnosticQuestions: {
                            questions:
                              data.questions as DiagnosticQuestionsData["questions"],
                            question: data.question,
                            nodeId: data.nodeId,
                          },
                        },
                      ],
                    },
                  },
                ];
              });
            } else if (
              event.type === SSEEventType.RoadmapUpdated &&
              event.data
            ) {
              const data = event.data as { nodes: unknown[] };
              options?.onRoadmapUpdate?.(data.nodes);
            } else if (
              event.type === SSEEventType.SessionUpdated &&
              event.data
            ) {
              const data = event.data as {
                masteredNodes?: number;
                totalNodes?: number;
                title?: string;
                learningStatus?: string;
              };
              options?.onSessionUpdate?.(data);
            } else if (event.type === SSEEventType.TitleUpdated && event.data) {
              const data = event.data as { title?: string };
              if (data.title) options?.onTitleUpdate?.(data.title);
            } else if (event.type === SSEEventType.StepStart && event.data) {
              const data = event.data as { step: number; total: number };
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: updateLoopTrace(existing, (trace) => ({
                        ...trace,
                        steps: [
                          ...trace.steps,
                          {
                            step: Number(data.step),
                            total: Number(data.total),
                            t0: Date.now(),
                          },
                        ],
                      })),
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.StepEnd && event.data) {
              const data = event.data as { step: number; durationMs?: number };
              const stepNum = Number(data.step);
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: updateLoopTrace(existing, (trace) => ({
                        ...trace,
                        steps: trace.steps.map((s) =>
                          s.step === stepNum
                            ? {
                                ...s,
                                durationMs:
                                  data.durationMs ?? Date.now() - s.t0,
                              }
                            : s,
                        ),
                      })),
                    },
                  },
                ];
              });
            } else if (
              event.type === SSEEventType.ReasoningDelta &&
              event.data
            ) {
              const data = event.data as { step: number; text: string };
              const stepNum = Number(data.step);
              const delta = String(data.text ?? "");
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: updateLoopTrace(existing, (trace) => ({
                        ...trace,
                        steps: trace.steps.map((s) =>
                          s.step === stepNum
                            ? { ...s, reasoning: (s.reasoning ?? "") + delta }
                            : s,
                        ),
                      })),
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.Failover && event.data) {
              const data = event.data as {
                from: string;
                to: string;
                reason: string;
                step: number;
              };
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: updateLoopTrace(existing, (trace) => ({
                        ...trace,
                        failovers: [
                          ...(trace.failovers ?? []),
                          {
                            from: String(data.from),
                            to: String(data.to),
                            reason: String(data.reason ?? ""),
                            step: Number(data.step),
                          },
                        ],
                      })),
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.LoopWarning && event.data) {
              const data = event.data as {
                type: string;
                toolName: string;
                step: number;
              };
              setMessages((prev) => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  {
                    ...prev[idx],
                    metadata: {
                      ...prev[idx].metadata,
                      annotations: updateLoopTrace(existing, (trace) => ({
                        ...trace,
                        loopWarnings: [
                          ...(trace.loopWarnings ?? []),
                          {
                            type: String(data.type ?? ""),
                            toolName: String(data.toolName ?? ""),
                            step: Number(data.step),
                          },
                        ],
                      })),
                    },
                  },
                ];
              });
            } else if (event.type === SSEEventType.Usage && event.data) {
              const usageEvent = event.data as UsageEventData;
              if (usageEvent.usage) {
                setTokenUsage((prev) => mergeUsage(prev, usageEvent));
              }
            } else if (event.type === SSEEventType.ContextInfo && event.data) {
              setContextInfo(event.data as ContextInfo);
            } else if (event.type === SSEEventType.Error) {
              const errorMsg =
                typeof event.data === "string"
                  ? event.data
                  : ((event.data as Record<string, unknown>)?.message ??
                    "AI 服务异常，请稍后重试");
              options?.onError?.(String(errorMsg));
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Resume stream error:", err);
      }
    } finally {
      setIsLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      options?.onFinish?.();
    }
  }, [isLoading, sessionId, options]);

  return {
    messages,
    input,
    isLoading,
    handleInputChange,
    handleSubmit,
    submitMessage,
    submitHiddenMessage,
    stop,
    setMessages,
    resumeStream,
    tokenUsage,
    contextInfo,
  };
}
