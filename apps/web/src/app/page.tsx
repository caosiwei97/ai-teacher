import { redirect } from "next/navigation";
import { prisma } from "@ai-teacher/db";
import { NewSessionForm } from "./new-session-form";

const USER_ID = "seed-user-ai-teacher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const activeSession = await prisma.session.findFirst({
    where: {
      userId: USER_ID,
      status: { notIn: ["completed", "archived"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (activeSession) {
    redirect(`/learn/${activeSession.id}`);
  }

  return <NewSessionForm />;
}
