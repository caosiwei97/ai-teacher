import { prisma } from "@ai-teacher/db";

interface ToolResultEntry {
  toolName: string;
  result: unknown;
}

export const MessageService = {
  async persistTurn(
    sessionId: string,
    userMessage: string,
    assistantContent: string,
    toolResults: ToolResultEntry[],
  ) {
    const assistantMetadata =
      toolResults.length > 0
        ? JSON.parse(
            JSON.stringify({
              toolResults: toolResults.map((tr) => ({
                toolName: tr.toolName,
                result: tr.result,
              })),
            }),
          )
        : undefined;

    const hasAssessment = toolResults.some(
      (tr) => tr.toolName === "generateAssessment",
    );

    await prisma.$transaction([
      prisma.message.create({
        data: { sessionId, role: "learner", type: "text", content: userMessage },
      }),
      prisma.message.create({
        data: {
          sessionId,
          role: "tutor",
          type: hasAssessment ? "assessment" : "text",
          content: assistantContent,
          metadata: assistantMetadata,
        },
      }),
    ]);
  },
};
