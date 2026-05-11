import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    // 按外键依赖顺序删除：叶子节点 → 中间表 → 根表
    console.log("🗑️  清空数据库数据...");

    const result = await prisma.$transaction([
      prisma.message.deleteMany(),
      prisma.checkpoint.deleteMany(),
      prisma.node.deleteMany(),
      prisma.roadmap.deleteMany(),
      prisma.session.deleteMany(),
      prisma.learnerProfile.deleteMany(),
      prisma.source.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    const total = result.reduce((sum, r) => sum + r.count, 0);
    console.log(`✅ 已删除 ${total} 条记录`);
  } catch (error) {
    console.error("❌ 清空失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
