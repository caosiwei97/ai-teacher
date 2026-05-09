"use client";

import { useState, useCallback, useRef } from "react";
import type { Message } from "ai";

interface UseChatStreamOptions {
  onFinish?: () => void;
}

interface SSEEvent {
  type: string;
  content?: string;
  data?: unknown;
}

export function useChatStream(sessionId: string, options?: UseChatStreamOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
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

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: input.trim(),
      };

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        annotations: [],
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
              content: m.content,
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
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || ""; // Keep potentially incomplete event in buffer

          for (const part of parts) {
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
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  content: newMessages[assistantIdx].content + event.content,
                };
                setMessages([...newMessages]);
              } else if (event.type === "tool-call" && event.data) {
                const data = event.data as Record<string, unknown>;
                const existing = newMessages[assistantIdx].annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  annotations: [
                    ...existing,
                    { toolName: data.toolName, args: data.args },
                  ] as Message["annotations"],
                };
                setMessages([...newMessages]);
              } else if (event.type === "tool-result" && event.data) {
                const data = event.data as Record<string, unknown>;
                const existing = newMessages[assistantIdx].annotations ?? [];
                newMessages[assistantIdx] = {
                  ...newMessages[assistantIdx],
                  annotations: [
                    ...existing,
                    { toolName: data.toolName, result: data.result },
                  ] as Message["annotations"],
                };
                setMessages([...newMessages]);
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
