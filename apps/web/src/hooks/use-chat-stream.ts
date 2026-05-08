"use client";

import { useChat } from "ai/react";
import type { Message } from "ai";

interface SessionMessage {
  role: string;
  content: string;
}

export function useChatStream(sessionId: string, initialMessages?: SessionMessage[]) {
  const mapped: Message[] = (initialMessages ?? [])
    .filter((m) => m.role === "learner" || m.role === "tutor")
    .map((m) => ({
      id: crypto.randomUUID(),
      role: m.role === "learner" ? "user" : "assistant",
      content: m.content,
    }));

  return useChat({
    api: "/api/chat",
    body: { sessionId },
    initialMessages: mapped,
  });
}
