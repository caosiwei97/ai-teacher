"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ThreeColumnLayout } from "@/components/layout/three-column";
import { ChatArea } from "@/components/chat/chat-area";
import { useChatStream } from "@/hooks/use-chat-stream";
import { fetchSession, fetchSessions } from "@/lib/api-client";
import type { Message } from "ai";

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

export default function LearnPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const chat = useChatStream(sessionId);

  useEffect(() => {
    if (!sessionId) return;

    Promise.all([fetchSessions(USER_ID), fetchSession(sessionId)])
      .then(([sessionsData, sessionData]) => {
        setSessions(sessionsData.sessions);
        setNodes(sessionData.session.roadmap?.nodes ?? []);

        const historyMessages: Message[] = sessionData.session.messages
          .filter((m) => m.role === "learner" || m.role === "tutor")
          .map((m, i) => ({
            id: `init-${i}`,
            role: (m.role === "learner" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          }));
        chat.setMessages(historyMessages);
        setLoaded(true);
      })
      .catch(console.error);
  }, [sessionId]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id !== sessionId) {
        router.push(`/learn/${id}`);
      }
    },
    [sessionId, router],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (chat.input.trim()) {
      chat.handleSubmit(e);
    }
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

  return (
    <ThreeColumnLayout
      sessions={sessions}
      currentSessionId={sessionId}
      nodes={nodes}
      onSelectSession={handleSelectSession}
    >
      <ChatArea
        messages={chat.messages}
        input={chat.input}
        isLoading={chat.isLoading}
        onInputChange={chat.handleInputChange}
        onSubmit={handleSubmit}
        onStop={chat.stop}
      />
    </ThreeColumnLayout>
  );
}
