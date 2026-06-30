import { Outlet } from "react-router";
import { SessionContextProvider, useSession } from "@/contexts/session-context";
import { ThreeColumnLayout } from "@/components/layout/three-column";

function AppShell() {
  const { sessions, currentSessionId, selectSession, createNewSession, archiveSession, newSessionHint } = useSession();

  return (
    <ThreeColumnLayout
      sessions={sessions}
      currentSessionId={currentSessionId ?? undefined}
      onSelectSession={selectSession}
      onNewSession={createNewSession}
      onArchiveSession={archiveSession}
    >
      <Outlet />
      {newSessionHint && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
          <div className="pointer-events-auto rounded-xl bg-foreground/90 px-5 py-2.5 text-sm font-medium text-background shadow-lg backdrop-blur-sm">
            {newSessionHint}
          </div>
        </div>
      )}
    </ThreeColumnLayout>
  );
}

export function AppLayout() {
  return (
    <SessionContextProvider>
      <AppShell />
    </SessionContextProvider>
  );
}
