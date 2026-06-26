import { prisma } from "@ai-teacher/db";

interface SessionSummary {
  topic: string;
  masteredNodes: string[];
  totalNodes: number;
  strengths: string[];
  weaknesses: string[];
  date: string;
}

export const ProfileService = {
  async updateAfterSession(userId: string, sessionSummary: SessionSummary) {
    const existing = await prisma.learnerProfile.findUnique({
      where: { userId },
    });

    const existingStrengths: string[] = Array.isArray(existing?.strengths)
      ? (existing.strengths as unknown as string[])
      : [];
    const existingWeaknesses: string[] = Array.isArray(existing?.weaknesses)
      ? (existing.weaknesses as unknown as string[])
      : [];
    const existingPatterns: Array<{ area: string; misconception: string }> =
      Array.isArray(existing?.misconceptionPatterns)
        ? (existing.misconceptionPatterns as unknown as Array<{
            area: string;
            misconception: string;
          }>)
        : [];
    const existingSessions: SessionSummary[] = Array.isArray(
      existing?.sessionsSummary,
    )
      ? (existing.sessionsSummary as unknown as SessionSummary[])
      : [];

    const newStrengths = [
      ...new Set([...existingStrengths, ...sessionSummary.strengths]),
    ];
    const newWeaknesses = [
      ...new Set([...existingWeaknesses, ...sessionSummary.weaknesses]),
    ];
    const newSessions = [...existingSessions, sessionSummary].slice(-10);

    await prisma.learnerProfile.upsert({
      where: { userId },
      create: {
        userId,
        strengths: JSON.parse(JSON.stringify(newStrengths)),
        weaknesses: JSON.parse(JSON.stringify(newWeaknesses)),
        misconceptionPatterns: JSON.parse(JSON.stringify(existingPatterns)),
        sessionsSummary: JSON.parse(JSON.stringify(newSessions)),
      },
      update: {
        strengths: JSON.parse(JSON.stringify(newStrengths)),
        weaknesses: JSON.parse(JSON.stringify(newWeaknesses)),
        sessionsSummary: JSON.parse(JSON.stringify(newSessions)),
      },
    });
  },
};
