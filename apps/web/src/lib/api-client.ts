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

export async function generateDiagnostic(sessionId: string) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/diagnostic`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to generate diagnostic");
  return res.json() as Promise<{
    questions: Array<{
      id: string;
      nodeIndex: number;
      question: string;
      type: "choice" | "open";
      options: Array<{ label: string; text: string }>;
      correctAnswer: string;
    }>;
  }>;
}

export async function evaluateDiagnostic(
  sessionId: string,
  data: {
    questions: Array<{
      id: string;
      question: string;
      type: string;
      correctAnswer: string;
      nodeIndex: number;
    }>;
    answers: Array<{ questionId: string; answer: string }>;
  },
) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/diagnostic/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to evaluate diagnostic");
  return res.json() as Promise<{
    evaluation: {
      startingNodeIndex: number;
      reasoning: string;
      answersummary: Array<{ questionId: string; correct: boolean; brief: string }>;
    };
    startingNode: { id: string; index: number; title: string };
  }>;
}
