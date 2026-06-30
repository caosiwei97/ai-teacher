import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { fetchSessions, archiveSession as archiveSessionApi } from "@/lib/api-client";

const USER_ID = "seed-user-ai-teacher";

interface SessionInfo {
  id: string;
  topic: string;
  status: string;
  activeMode?: "learning" | "review" | "interview";
  progress: { totalNodes: number; masteredNodes: number; currentNodeId: string | null };
}

interface SessionContextValue {
  sessions: SessionInfo[];
  setSessions: React.Dispatch<React.SetStateAction<SessionInfo[]>>;
  currentSessionId: string | null;
  selectSession: (id: string) => void;
  createNewSession: () => void;
  archiveSession: (id: string) => void;
  refreshSessions: () => Promise<void>;
  sessionsLoaded: boolean;
  newSessionHint: string | null;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionContextProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [newSessionHint, setNewSessionHint] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(/^\/learn\/([^/]+)/);
      return match ? match[1] : null;
    }
    return null;
  });

  useEffect(() => {
    const match = pathname.match(/^\/learn\/([^/]+)/);
    if (match) {
      setCurrentSessionId(match[1]);
    }
  }, [pathname]);

  useEffect(() => {
    fetchSessions(USER_ID)
      .then((data) => {
        setSessions(data.sessions);
        setSessionsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to fetch sessions:", err);
        setSessionsLoaded(true);
      });
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await fetchSessions(USER_ID);
      setSessions(data.sessions);
    } catch (err) {
      console.error("Failed to refresh sessions:", err);
    }
  }, []);

  const navigate = useNavigate();
  const selectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
    navigate(`/learn/${id}`, { replace: true });
  }, [navigate]);

  // 「新对话」按钮：已在 /learn 引导态且无对话时提示「当前已是新对话」无需跳转；
  // 其他情况（含在 /settings 等非 learn 路由）跳回 /learn（无 id 引导态），
  // 用户输入首条消息才建会话（发消息才产生对话 id）
  const createNewSession = useCallback(() => {
    if (sessions.length === 0 && pathname === "/learn") {
      setNewSessionHint("当前已是新对话");
      window.setTimeout(() => setNewSessionHint(null), 2500);
      return;
    }
    setCurrentSessionId(null);
    navigate("/learn", { replace: true });
  }, [navigate, sessions.length, pathname]);

  const archiveSession = useCallback(
    async (id: string) => {
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);

      if (id === currentSessionId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          setCurrentSessionId(next.id);
          navigate(`/learn/${next.id}`, { replace: true });
        } else {
          // 删完所有会话 → 回引导态（/learn 无 id），不创建本地空会话
          setCurrentSessionId(null);
          navigate("/learn", { replace: true });
        }
      }

      try {
        await archiveSessionApi(id);
      } catch (err) {
        console.error("Failed to archive session:", err);
        refreshSessions();
      }
    },
    [sessions, currentSessionId, navigate, refreshSessions],
  );

  const value = useMemo(
    () => ({
      sessions,
      setSessions,
      currentSessionId,
      selectSession,
      createNewSession,
      archiveSession,
      refreshSessions,
      sessionsLoaded,
      newSessionHint,
    }),
    [sessions, currentSessionId, selectSession, createNewSession, archiveSession, refreshSessions, sessionsLoaded, newSessionHint],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionContextProvider");
  }
  return ctx;
}
