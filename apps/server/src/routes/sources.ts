import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import crypto from "node:crypto";
import { prisma } from "@ai-teacher/db";
import { SourceUrlInput, type SourceRecord } from "@ai-teacher/shared";
import { sourceQueue } from "../services/queue";
import { buildSourceKey, putObject, deleteObject } from "@ai-teacher/shared/services/storage";

// 迭代 009：学习资料 CRUD + 上传/URL 导入。上传后创建 Source(pending) 并 enqueue 异步处理 job。

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

// 异步处理 job 重试：解析/embedding 偶发 transient 错误（如 DB 空闲连接被关闭）时指数退避重试
const SOURCE_JOB_OPTS = { attempts: 3, backoff: { type: "exponential" as const, delay: 1000 } };

function toSourceRecord(s: {
  id: string;
  userId: string;
  title: string;
  type: string;
  content: string | null;
  fileUrl: string | null;
  checksum: string | null;
  status: string;
  createdAt: Date;
}): SourceRecord {
  return {
    id: s.id,
    userId: s.userId,
    title: s.title,
    type: s.type as "pdf" | "markdown",
    content: s.content,
    fileUrl: s.fileUrl,
    checksum: s.checksum,
    status: s.status as "pending" | "processing" | "ready" | "failed",
    createdAt: s.createdAt.toISOString(),
  };
}

function detectType(filename: string): "pdf" | "markdown" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  return null;
}

export const sourcesRoute = new Hono()
  // 上传文件（PDF / Markdown）
  .post("/", async (c) => {
    const formData = await c.req.formData();
    const userId = formData.get("userId");
    const file = formData.get("file");

    if (typeof userId !== "string" || !userId) {
      return c.json({ error: "userId is required" }, 400);
    }
    if (!(file instanceof File)) {
      return c.json({ error: "file is required" }, 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return c.json({ error: `file too large (>${MAX_FILE_BYTES / 1024 / 1024}MB)` }, 413);
    }

    const type = detectType(file.name);
    if (!type) {
      return c.json({ error: "unsupported file type (only .pdf / .md)" }, 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return c.json({ error: "User not found" }, 404);

    const buffer = Buffer.from(await file.arrayBuffer());

    if (type === "markdown") {
      // Markdown：文本直接存 content，不走 MinIO
      const content = buffer.toString("utf-8");
      const source = await prisma.source.create({
        data: { userId, title: file.name, type: "markdown", content, status: "pending" },
      });
      await sourceQueue.add("source-processing", { sourceId: source.id }, SOURCE_JOB_OPTS);
      return c.json({ source: toSourceRecord(source) }, 201);
    }

    // PDF：原始文件存 MinIO
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const source = await prisma.source.create({
      data: { userId, title: file.name, type: "pdf", checksum, status: "pending" },
    });
    const key = buildSourceKey(source.id, file.name);
    await putObject(key, buffer, file.type || "application/pdf");
    await prisma.source.update({ where: { id: source.id }, data: { fileUrl: key } });
    source.fileUrl = key;

    await sourceQueue.add("source-processing", { sourceId: source.id }, SOURCE_JOB_OPTS);
    return c.json({ source: toSourceRecord(source) }, 201);
  })

  // URL 导入（Jina Reader 解析）
  .post("/url", zValidator("json", SourceUrlInput), async (c) => {
    const { userId, url } = c.req.valid("json");

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return c.json({ error: "User not found" }, 404);

    const source = await prisma.source.create({
      data: { userId, title: url, type: "markdown", fileUrl: url, status: "pending" },
    });
    await sourceQueue.add("source-processing", { sourceId: source.id }, SOURCE_JOB_OPTS);
    return c.json({ source: toSourceRecord(source) }, 201);
  })

  // 列出用户资料
  .get("/", async (c) => {
    const userId = c.req.query("userId") ?? "";
    const parsed = z.object({ userId: z.string().min(1) }).safeParse({ userId });
    if (!parsed.success) {
      return c.json({ error: "userId is required", details: z.flattenError(parsed.error) }, 400);
    }

    const sources = await prisma.source.findMany({
      where: { userId: parsed.data.userId },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ sources: sources.map(toSourceRecord) });
  })

  // 删除（级联 DocumentChunk + 清理 MinIO 对象）
  .delete("/:sourceId", async (c) => {
    const sourceId = c.req.param("sourceId");
    const userId = c.req.query("userId") ?? "";

    const source = await prisma.source.findFirst({ where: { id: sourceId, userId } });
    if (!source) return c.json({ error: "Source not found for user" }, 404);

    if (source.fileUrl && !source.fileUrl.startsWith("http")) {
      await deleteObject(source.fileUrl).catch(() => {});
    }
    await prisma.source.delete({ where: { id: sourceId } });
    return c.json({ ok: true });
  });
