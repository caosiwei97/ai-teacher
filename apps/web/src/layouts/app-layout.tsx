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
      newSessionHint={newSessionHint}
    >
      <Outlet />
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
