"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ThreeColumnLayout } from "@/components/layout/three-column";
import { ChatArea } from "@/components/chat/chat-area";
import { useChatStream } from "@/hooks/use-chat-stream";
import { fetchSession, fetchSessions } from "@/lib/api-client";

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
  const [initialMessages, setInitialMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  const chat = useChatStream(sessionId, loaded ? initialMessages : []);

  useEffect(() => {
    if (!sessionId) return;

    Promise.all([fetchSessions(USER_ID), fetchSession(sessionId)])
      .then(([sessionsData, sessionData]) => {
        setSessions(sessionsData.sessions);
        const roadmapNodes = sessionData.session.roadmap?.nodes ?? [];
        setNodes(roadmapNodes);
        setInitialMessages(
          sessionData.session.messages.map((m) => ({ role: m.role, content: m.content }))
        );
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
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-400">加载中...</p>
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
