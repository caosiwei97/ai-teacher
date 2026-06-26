import type { Readable } from "node:stream";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// MinIO / S3 兼容对象存储封装（迭代 009，047 Phase 2 落地）。
// server 上传存原始文件、worker 取 PDF 解析共用此服务，故置于 shared/services（子路径导出，不进 web bundle）。

interface StorageConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface ResolvedStorageConfig extends StorageConfig {
  bucket: string;
}

/** 从环境变量解析存储配置；缺关键项时抛错（启动期暴露配置问题） */
export function resolveStorageConfig(): StorageConfig {
  const host = process.env.MINIO_ENDPOINT || "localhost";
  const port = Number(process.env.MINIO_PORT) || 29000;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucket = process.env.MINIO_BUCKET || "ai-teacher";
  if (!accessKey || !secretKey) {
    throw new Error(
      "MINIO_ACCESS_KEY / MINIO_SECRET_KEY not set. Configure them in .env (see .env.example).",
    );
  }
  return { endpoint: `http://${host}:${port}`, accessKey, secretKey, bucket };
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (!cachedClient) {
    const cfg = resolveStorageConfig();
    cachedClient = new S3Client({
      endpoint: cfg.endpoint,
      region: "us-east-1", // MinIO 忽略，但 SDK 必填
      credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
      forcePathStyle: true, // MinIO 必须 path-style
    });
  }
  return cachedClient;
}

export function getBucket(): string {
  return resolveStorageConfig().bucket;
}

/** 构造对象 key：sources/{sourceId}/{filename} */
export function buildSourceKey(sourceId: string, filename: string): string {
  return `sources/${sourceId}/${filename}`;
}

/** 启动期确保 bucket 存在（幂等）。供 server 启动回调 fire-and-forget 调用，失败不应阻断启动 */
export async function ensureBucket(): Promise<void> {
  const s3 = getClient();
  const bucket = getBucket();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[storage] Created bucket: ${bucket}`);
  }
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObject(key: string): Promise<Buffer> {
  const s3 = getClient();
  const res = await s3.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  if (!res.Body) throw new Error(`storage: object not found: ${key}`);
  return streamToBuffer(res.Body as Readable);
}

export async function deleteObject(key: string): Promise<void> {
  const s3 = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/** 把 S3 返回的可读流聚合成 Buffer（PDF 解析需要完整字节） */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
