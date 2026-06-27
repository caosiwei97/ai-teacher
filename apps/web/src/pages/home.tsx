import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { fetchSessions, getEnvStatus } from "@/lib/api-client";

const USER_ID = "seed-user-ai-teacher";

function generateNewSessionId() {
  const hex = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function Component() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await getEnvStatus();
        // 主模型就绪 = DB 有 default 配置 或 env 有 KEY
        setReady(status.hasDefaultDbConfig || status.hasEnvConfig);
      } catch {
        setReady(true); // 检测失败不阻塞，放行让用户进入
      }
    })();
  }, []);

  useEffect(() => {
    if (ready !== true) return;
    fetchSessions(USER_ID)
      .then(({ sessions }) => {
        const learning = sessions.find(
          (s) => s.status === "active" || s.status === "diagnosing",
        );
        if (learning) {
          navigate(`/learn/${learning.id}`, { replace: true });
        } else {
          navigate(`/learn/${generateNewSessionId()}`, { replace: true });
        }
      })
      .catch(() => navigate(`/learn/${generateNewSessionId()}`, { replace: true }));
  }, [navigate, ready]);

  if (ready === false) {
    // 软引导：主模型未就绪，提示但不强制
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="mb-2 text-lg font-semibold text-foreground">检测到尚未配置模型</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            核心教学功能需要配置 API Key。先去配置，或先看看（部分功能可用）。
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate("/settings")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              去配置
            </button>
            <button
              onClick={() => setReady(true)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              先进入
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-pulse-soft rounded-full bg-roadmap-fill" />
      </div>
    </div>
  );
}
