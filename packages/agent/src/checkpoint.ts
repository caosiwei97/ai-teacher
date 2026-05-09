import type { CheckpointStore } from "./types";

/**
 * Prisma-backed CheckpointStore.
 *
 * Expects a Prisma model named `Checkpoint` with fields:
 * - id: String @id @default(cuid())
 * - sessionId: String
 * - graphNode: String
 * - state: Json
 * - createdAt: DateTime @default(now())
 */
export class PrismaCheckpointStore implements CheckpointStore {
  // PrismaClient is a peer dependency — the consumer provides the typed client.
  // Dynamic access patterns are intentional to avoid hard coupling to a specific schema.
  private prisma: {
    checkpoint: {
      create: (args: { data: { sessionId: string; graphNode: string; state: unknown } }) => Promise<{ id: string }>;
      findUnique: (args: { where: { id: string } }) => Promise<{ graphNode: string; state: unknown } | null>;
      findFirst: (args: { where: { sessionId: string }; orderBy: { createdAt: string } }) => Promise<{ graphNode: string; state: unknown } | null>;
    };
  };

  constructor(prisma: unknown) {
    this.prisma = prisma as typeof this.prisma;
  }

  async save(sessionId: string, graphNode: string, state: unknown): Promise<string> {
    const record = await this.prisma.checkpoint.create({
      data: {
        sessionId,
        graphNode,
        state: JSON.parse(JSON.stringify(state)),
      },
    });
    return record.id;
  }

  async load(checkpointId: string): Promise<{ graphNode: string; state: unknown } | null> {
    const record = await this.prisma.checkpoint.findUnique({
      where: { id: checkpointId },
    });
    if (!record) return null;
    return { graphNode: record.graphNode, state: record.state };
  }

  async loadLatest(sessionId: string): Promise<{ graphNode: string; state: unknown } | null> {
    const record = await this.prisma.checkpoint.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    if (!record) return null;
    return { graphNode: record.graphNode, state: record.state };
  }
}
