"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { UIMessage } from "ai";

interface UseChatStreamOptions {
  teachingMode?: "warm" | "strict" | "interviewer";
  llmConfigId?: string;
  onFinish?: () => void;
  onError?: (error: string) => void;
  onRoadmapUpdate?: (nodes: unknown[]) => void;
  onSessionUpdate?: (data: { masteredNodes?: number; totalNodes?: number; title?: string; learningStatus?: string }) => void;
}

interface SSEEvent {
  type: string;
  content?: string;
  data?: unknown;
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

export interface AnnotationData {
  toolName?: string;
  args?: unknown;
  result?: unknown;
  uiBlocks?: unknown[];
  codePush?: { code: string; language: string; instruction?: string };
  diagnosticQuestions?: DiagnosticQuestionsData;
  roadmapUpdate?: { nodes: unknown[] };
  sessionUpdate?: { masteredNodes?: number; totalNodes?: number; title?: string; learningStatus?: string };
}

export interface MessageMetadata {
  annotations?: AnnotationData[];
}

function getTextFromParts(parts: UIMessage["parts"]): string {
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function useChatStream(sessionId: string, options?: UseChatStreamOptions) {
  const [messages, setMessages] = useState<UIMessage<MessageMetadata>[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup: abort any in-flight SSE stream when component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent, overrideText?: string) => {
      e?.preventDefault();
      const text = overrideText ?? input;
      if (!text.trim() || isLoading) return;

      const userMessage: UIMessage<MessageMetadata> = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text" as const, text: text.trim() }],
      };

      const assistantMessage: UIMessage<MessageMetadata> = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text" as const, text: "" }],
        metadata: { annotations: [] },
      };

      const newMessages = [...messages, userMessage, assistantMessage];
      setMessages(newMessages);
      setInput("");
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
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: getTextFromParts(m.parts),
            })),
            ...(options?.teachingMode ? { teachingMode: options.teachingMode } : {}),
            ...(options?.llmConfigId ? { llmConfigId: options.llmConfigId } : {}),
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

              let event: SSEEvent;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                continue;
              }

              const assistantIdx = newMessages.length - 1;

              if (event.type === "text-delta" && typeof event.content === "string") {
                if (textFrozen) continue;
                const prevText = getTextFromParts(newMessages[assistantIdx].parts);
                const updatedText = prevText + event.content;
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: [{ type: "text" as const, text: updatedText }],
                };
                setMessages([...newMessages]);
              } else if (event.type === "tool-call" && event.data) {
                const data = event.data as Record<string, unknown>;
                const existing = newMessages[assistantIdx].metadata?.annotations ?? [];
                const toolName = String(data.toolName);
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [...existing, { toolName, args: data.args }],
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === "tool-result" && event.data) {
                const data = event.data as Record<string, unknown>;
                const existing = newMessages[assistantIdx].metadata?.annotations ?? [];
                const toolName = String(data.toolName);
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [...existing, { toolName, result: data.result }],
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === "ui-blocks" && event.data) {
                const data = event.data as { uiBlocks: unknown[] };
                const existing = newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [...existing, { uiBlocks: data.uiBlocks }],
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === "code-push" && event.data) {
                const data = event.data as { code: string; language: string; instruction?: string };
                const existing = newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [...existing, { codePush: data }],
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === "ask-question" && event.data) {
                textFrozen = true;
                const data = event.data as { questions: unknown[]; question: string; nodeId: string };
                const existing = newMessages[assistantIdx].metadata?.annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  parts: newMessages[assistantIdx].parts,
                  metadata: {
                    ...newMessages[assistantIdx].metadata,
                    annotations: [...existing, {
                      diagnosticQuestions: {
                        questions: data.questions as DiagnosticQuestionsData["questions"],
                        question: data.question,
                        nodeId: data.nodeId,
                      },
                    }],
                  },
                };
                setMessages([...newMessages]);
              } else if (event.type === "roadmap-updated" && event.data) {
                const data = event.data as { nodes: unknown[] };
                options?.onRoadmapUpdate?.(data.nodes);
              } else if (event.type === "session-updated" && event.data) {
                const data = event.data as { masteredNodes?: number; totalNodes?: number; title?: string; learningStatus?: string };
                options?.onSessionUpdate?.(data);
              } else if (event.type === "error") {
                const errorMsg =
                  typeof event.data === "string"
                    ? event.data
                    : (event.data as Record<string, unknown>)?.message ?? "AI 服务异常，请稍后重试";
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

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const submitMessage = useCallback(
    (text: string) => {
      handleSubmit(undefined, text);
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

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !getTextFromParts(last.parts)) {
          return prev;
        }
        return [...prev, {
          id: `assistant-resume-${Date.now()}`,
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "" }],
          metadata: { annotations: [] },
        }];
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

            let event: SSEEvent;
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (event.type === "text-delta" && typeof event.content === "string") {
              const delta = event.content;
              setMessages(prev => {
                const idx = prev.length - 1;
                const prevText = getTextFromParts(prev[idx].parts);
                return [
                  ...prev.slice(0, idx),
                  { ...prev[idx], parts: [{ type: "text" as const, text: prevText + delta }] },
                ];
              });
            } else if (event.type === "tool-call" && event.data) {
              const data = event.data as Record<string, unknown>;
              const toolName = String(data.toolName);
              setMessages(prev => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  { ...prev[idx], metadata: { ...prev[idx].metadata, annotations: [...existing, { toolName, args: data.args }] } },
                ];
              });
            } else if (event.type === "tool-result" && event.data) {
              const data = event.data as Record<string, unknown>;
              const toolName = String(data.toolName);
              setMessages(prev => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  { ...prev[idx], metadata: { ...prev[idx].metadata, annotations: [...existing, { toolName, result: data.result }] } },
                ];
              });
            } else if (event.type === "ui-blocks" && event.data) {
              const data = event.data as { uiBlocks: unknown[] };
              setMessages(prev => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  { ...prev[idx], metadata: { ...prev[idx].metadata, annotations: [...existing, { uiBlocks: data.uiBlocks }] } },
                ];
              });
            } else if (event.type === "code-push" && event.data) {
              const data = event.data as { code: string; language: string; instruction?: string };
              setMessages(prev => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  { ...prev[idx], metadata: { ...prev[idx].metadata, annotations: [...existing, { codePush: data }] } },
                ];
              });
            } else if (event.type === "ask-question" && event.data) {
              const data = event.data as { questions: unknown[]; question: string; nodeId: string };
              setMessages(prev => {
                const idx = prev.length - 1;
                const existing = prev[idx].metadata?.annotations ?? [];
                return [
                  ...prev.slice(0, idx),
                  { ...prev[idx], metadata: { ...prev[idx].metadata, annotations: [...existing, { diagnosticQuestions: { questions: data.questions as DiagnosticQuestionsData["questions"], question: data.question, nodeId: data.nodeId } }] } },
                ];
              });
            } else if (event.type === "roadmap-updated" && event.data) {
              const data = event.data as { nodes: unknown[] };
              options?.onRoadmapUpdate?.(data.nodes);
            } else if (event.type === "session-updated" && event.data) {
              const data = event.data as { masteredNodes?: number; totalNodes?: number; title?: string; learningStatus?: string };
              options?.onSessionUpdate?.(data);
            } else if (event.type === "error") {
              const errorMsg =
                typeof event.data === "string"
                  ? event.data
                  : (event.data as Record<string, unknown>)?.message ?? "AI 服务异常，请稍后重试";
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

  return { messages, input, isLoading, handleInputChange, handleSubmit, submitMessage, stop, setMessages, resumeStream };
}
