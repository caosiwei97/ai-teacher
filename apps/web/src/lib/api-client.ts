export async function fetchSessions(userId: string) {
  const res = await fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json() as Promise<{
    sessions: Array<{
      id: string;
      topic: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      progress: { totalNodes: number; masteredNodes: number; currentNodeId: string | null; currentNodeTitle: string | null };
    }>;
  }>;
}

export async function fetchSession(sessionId: string) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json() as Promise<{
    session: {
      id: string;
      topic: string;
      status: string;
      messages: Array<{ id: string; role: string; type: string; content: string; metadata: unknown; createdAt: string }>;
      roadmap: { id: string; nodes: Array<{ id: string; index: number; title: string; description: string; status: string; masteryScore: number }> } | null;
    };
  }>;
}
