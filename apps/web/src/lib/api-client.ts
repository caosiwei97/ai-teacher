import type { SourceRecord } from "@ai-teacher/shared";

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
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch session");
  }
  return res.json() as Promise<{
    session: {
      id: string;
      topic: string;
      status: string;
      messages: Array<{ id: string; role: string; type: string; content: string; metadata: unknown; hidden?: boolean; status?: string; createdAt: string }>;
      roadmap: { id: string; nodes: Array<{ id: string; index: number; title: string; description: string; status: string; masteryScore: number }> } | null;
    };
  }>;
}

export async function archiveSession(sessionId: string) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to archive session");
  return res.json() as Promise<{
    success: true;
    session: {
      id: string;
      status: string;
    };
  }>;
}

export async function updateSessionStatus(sessionId: string, status: string) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update session status");
  return res.json() as Promise<{
    session: {
      id: string;
      topic: string;
      status: string;
      messages: Array<{ id: string; role: string; type: string; content: string; metadata: unknown; hidden?: boolean; createdAt: string }>;
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
      reasoningText: string;
      answersummary: Array<{ questionId: string; correct: boolean; brief: string }>;
    };
    startingNode: { id: string; index: number; title: string };
  }>;
}

// ─── LLM Config APIs ──────────────────────────────────────────────────

export interface LlmConfig {
  id: string;
  userId: string;
  provider: string;
  apiKey: string; // masked
  baseUrl: string | null;
  defaultModel: string;
  label: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  tier: "flagship" | "standard" | "value" | "light";
  price: string;
}

const LLM_BASE = "/api/llm";

export async function getLlmConfigs(userId: string) {
  const res = await fetch(`${LLM_BASE}?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch LLM configs");
  return res.json() as Promise<{ configs: LlmConfig[] }>;
}

export async function createLlmConfig(
  userId: string,
  data: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    defaultModel: string;
    label?: string;
    isDefault?: boolean;
  },
) {
  const res = await fetch(`${LLM_BASE}?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create LLM config");
  return res.json() as Promise<{ config: LlmConfig }>;
}

export async function updateLlmConfig(
  id: string,
  userId: string,
  data: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    label?: string;
    isDefault?: boolean;
  },
) {
  const res = await fetch(`${LLM_BASE}/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update LLM config");
  return res.json() as Promise<{ config: LlmConfig }>;
}

export async function deleteLlmConfig(id: string, userId: string) {
  const res = await fetch(`${LLM_BASE}/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete LLM config");
  return res.json() as Promise<{ success: boolean }>;
}

export async function testLlmConfig(id: string, userId: string) {
  const res = await fetch(`${LLM_BASE}/${encodeURIComponent(id)}/test?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to test LLM config");
  return res.json() as Promise<{ success: boolean; error?: string }>;
}

export async function getProviderModels(provider: string) {
  const res = await fetch(`${LLM_BASE}/models?provider=${encodeURIComponent(provider)}`);
  if (!res.ok) throw new Error("Failed to fetch provider models");
  return res.json() as Promise<{ provider: string; name: string; models: ModelInfo[] }>;
}

export async function getEnvStatus() {
  const res = await fetch(`${LLM_BASE}/env-status`);
  if (!res.ok) return { hasEnvConfig: false, baseUrl: "" };
  return res.json() as Promise<{ hasEnvConfig: boolean; baseUrl: string }>;
}

// ===== 学习资料（迭代 009 RAG）=====

const SOURCES_BASE = "/api/sources";

export async function listSources(userId: string) {
  const res = await fetch(`${SOURCES_BASE}?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to fetch sources");
  return res.json() as Promise<{ sources: SourceRecord[] }>;
}

export async function uploadSource(userId: string, file: File) {
  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("file", file);
  const res = await fetch(SOURCES_BASE, { method: "POST", body: formData });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`上传失败: ${msg || res.status}`);
  }
  return res.json() as Promise<{ source: SourceRecord }>;
}

export async function addSourceUrl(userId: string, url: string) {
  const res = await fetch(`${SOURCES_BASE}/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, url }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`导入失败: ${msg || res.status}`);
  }
  return res.json() as Promise<{ source: SourceRecord }>;
}

export async function deleteSource(sourceId: string, userId: string) {
  const res = await fetch(`${SOURCES_BASE}/${encodeURIComponent(sourceId)}?userId=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete source");
  return res.json() as Promise<{ ok: boolean }>;
}
