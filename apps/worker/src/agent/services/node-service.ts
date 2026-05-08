import { prisma } from "@ai-teacher/db";

export const NodeService = {
  async updateMastery(nodeId: string, score: number, reviewLog: unknown) {
    await prisma.node.update({
      where: { id: nodeId },
      data: {
        masteryScore: score,
        reviewLog: JSON.parse(JSON.stringify(reviewLog)),
        status: score >= 80 ? "mastered" : "in-progress",
        masteredAt: score >= 80 ? new Date() : null,
      },
    });
    if (score >= 80) {
      await this.autoAdvance(nodeId);
    }
  },

  async autoAdvance(currentNodeId: string) {
    const node = await prisma.node.findUnique({
      where: { id: currentNodeId },
      include: {
        roadmap: { include: { nodes: { orderBy: { index: "asc" } } } },
      },
    });
    if (!node) return;
    const nextNode = node.roadmap.nodes
      .filter((n) => n.index > node.index)
      .find((n) => n.status === "not-started");
    if (nextNode) {
      await prisma.node.update({
        where: { id: nextNode.id },
        data: { status: "in-progress" },
      });
    }
  },

  async advanceNode(
    currentNodeId: string,
    nextNodeId: string,
    masteryScore: number,
  ) {
    await prisma.$transaction([
      prisma.node.update({
        where: { id: currentNodeId },
        data: { status: "mastered", masteryScore, masteredAt: new Date() },
      }),
      prisma.node.update({
        where: { id: nextNodeId },
        data: { status: "in-progress" },
      }),
    ]);
  },
};
