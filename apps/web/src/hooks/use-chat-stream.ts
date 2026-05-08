"use client";

import { useChat } from "ai/react";

interface UseChatStreamOptions {
  onFinish?: () => void;
}

export function useChatStream(sessionId: string, options?: UseChatStreamOptions) {
  return useChat({
    api: "/api/chat",
    body: { sessionId },
    onFinish: () => {
      options?.onFinish?.();
    },
  });
}
