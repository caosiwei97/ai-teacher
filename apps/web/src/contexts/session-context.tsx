import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import { fetchSessions, archiveSession as archiveSessionApi } from "@/lib/api-client";

const USER_ID = "seed-user-ai-teacher";

interface SessionInfo {
  id: string;
  topic: string;
  status: string;
  progress: { totalNodes: number; masteredNodes: number; currentNodeId: string | null };
}

interface SessionContextValue {
  sessions: SessionInfo[];
  setSessions: React.Dispatch<React.SetStateAction<SessionInfo[]>>;
  currentSessionId: string | null;
  selectSession: (id: string) => void;
  createNewSession: () => string;
  archiveSession: (id: string) => void;
  refreshSessions: () => Promise<void>;
  sessionsLoaded: boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function generateUUID(): string {
  const hex = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function SessionContextProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
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

  const selectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
    window.history.replaceState(null, "", `/learn/${id}`);
  }, []);

  const createNewSession = useCallback(() => {
    const currentSession = sessions.find((s) => s.id === currentSessionId);
    if (currentSession && currentSession.status === "new") {
      alert("当前对话已经是新对话");
      return currentSessionId!;
    }

    const newId = generateUUID();
    setCurrentSessionId(newId);
    window.history.replaceState(null, "", `/learn/${newId}`);
    return newId;
  }, [sessions, currentSessionId]);

  const archiveSession = useCallback(
    async (id: string) => {
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);

      if (id === currentSessionId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          setCurrentSessionId(next.id);
          window.history.replaceState(null, "", `/learn/${next.id}`);
        } else {
          const newId = generateUUID();
          const newSession: SessionInfo = {
            id: newId,
            topic: "新对话",
            status: "new",
            progress: { totalNodes: 0, masteredNodes: 0, currentNodeId: null },
          };
          setSessions([newSession]);
          setCurrentSessionId(newId);
          window.history.replaceState(null, "", `/learn/${newId}`);
        }
      }

      try {
        await archiveSessionApi(id);
      } catch (err) {
        console.error("Failed to archive session:", err);
        refreshSessions();
      }
    },
    [sessions, currentSessionId, refreshSessions],
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
    }),
    [sessions, currentSessionId, selectSession, createNewSession, archiveSession, refreshSessions, sessionsLoaded],
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
