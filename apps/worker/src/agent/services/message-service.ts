import { prisma } from "@ai-teacher/db";

interface ToolResultEntry {
  toolName: string;
  result: unknown;
}

export const MessageService = {
  async persistTurn(
    sessionId: string,
    assistantContent: string,
    toolResults: ToolResultEntry[],
    options?: { hidden?: boolean },
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

    await prisma.message.create({
      data: {
        sessionId,
        role: "tutor",
        type: hasAssessment ? "assessment" : "text",
        content: assistantContent,
        metadata: assistantMetadata,
        hidden: options?.hidden ?? false,
      },
    });
  },
};
