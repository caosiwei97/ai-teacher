"use client";

import { useState, useCallback, useRef } from "react";
import type { UIMessage } from "ai";

interface UseChatStreamOptions {
  onFinish?: () => void;
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

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: UIMessage<MessageMetadata> = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text" as const, text: input.trim() }],
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
          }),
          signal: controller.signal,
        });

        if (!postRes.ok) {
          throw new Error(`Failed to send message: ${postRes.status}`);
        }

        const sseRes = await fetch(`/api/chat/${sessionId}/stream`, {
          signal: controller.signal,
        });

        if (!sseRes.ok) {
          throw new Error(`Failed to open stream: ${sseRes.status}`);
        }

        const reader = sseRes.body?.getReader();
        if (!reader) throw new Error("No stream body");

        const decoder = new TextDecoder();
        let buffer = "";

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
                    : (event.data as Record<string, unknown>)?.message ?? "Stream error";
                console.error("SSE error:", errorMsg);
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // intentional — user stopped generation
        } else {
          console.error("Chat stream error:", err);
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

  return { messages, input, isLoading, handleInputChange, handleSubmit, stop, setMessages };
}
