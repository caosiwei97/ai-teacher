import { PrismaClient } from "@prisma/client";

// 一次性清理脚本：删除 status 为 active/diagnosing 且无任何 Message 的孤儿空会话。
// 上一轮「先建后端」重构可能遗留这类空会话（用户建会后未发消息即离开）。
// 新机制「发消息才建会话」上线后不再产生空会话，此脚本清理历史遗留。
// 用法: pnpm --filter @ai-teacher/db cleanup-empty-sessions

async function main() {
  const prisma = new PrismaClient();

  try {
    // 查找无消息的 active/diagnosing 会话
    const emptySessions = await prisma.session.findMany({
      where: {
        status: { in: ["active", "diagnosing"] },
        messages: { none: {} },
      },
      select: { id: true, topic: true, status: true, createdAt: true },
    });

    if (emptySessions.length === 0) {
      console.log("✅ 无孤儿空会话，无需清理");
      return;
    }

    console.log(`🗑️  发现 ${emptySessions.length} 个孤儿空会话，开始清理...`);
    for (const s of emptySessions) {
      console.log(`   - ${s.id} | ${s.topic} | ${s.status} | ${s.createdAt.toISOString()}`);
    }

    // 级联删除：Session 删除会级联删除其 Roadmap（Roadmap 是 Session 的可选关联，
    // 但 Roadmap 无 sessionId 反向级联，需手动删 Roadmap 的 nodes）。
    // Prisma schema 中 Session.roadmap 是 1:1，删除 Session 时 Roadmap 会被级联删（onDelete: Cascade 默认）。
    const sessionIds = emptySessions.map((s) => s.id);

    // 先删 Roadmap nodes（Roadmap → Node 是 1:N，删 Roadmap 前需清 nodes）
    await prisma.node.deleteMany({
      where: { roadmap: { session: { id: { in: sessionIds } } } },
    });
    // 删 Roadmap
    await prisma.roadmap.deleteMany({
      where: { session: { id: { in: sessionIds } } },
    });
    // 删 Session
    const result = await prisma.session.deleteMany({
      where: { id: { in: sessionIds } },
    });

    console.log(`✅ 已清理 ${result.count} 个孤儿空会话`);
  } catch (error) {
    console.error("❌ 清理失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
