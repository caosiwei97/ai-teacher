"use client";

import { useChat } from "ai/react";

export function useChatStream(sessionId: string) {
  return useChat({
    api: "/api/chat",
    body: { sessionId },
  });
}
