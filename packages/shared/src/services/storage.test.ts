import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import {
  resolveStorageConfig,
  buildSourceKey,
  getBucket,
  streamToBuffer,
} from "./storage";

describe("storage", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.MINIO_ENDPOINT = "localhost";
    process.env.MINIO_PORT = "29000";
    process.env.MINIO_ACCESS_KEY = "minioadmin";
    process.env.MINIO_SECRET_KEY = "minioadmin";
    process.env.MINIO_BUCKET = "ai-teacher";
  });

  afterEach(() => {
    // 仅还原本次测试涉及的 key
    for (const k of [
      "MINIO_ENDPOINT",
      "MINIO_PORT",
      "MINIO_ACCESS_KEY",
      "MINIO_SECRET_KEY",
      "MINIO_BUCKET",
    ]) {
      if (k in origEnv) process.env[k] = origEnv[k];
      else delete process.env[k];
    }
  });

  describe("resolveStorageConfig", () => {
    it("从环境变量解析 endpoint / bucket", () => {
      const cfg = resolveStorageConfig();
      expect(cfg.endpoint).toBe("http://localhost:29000");
      expect(cfg.bucket).toBe("ai-teacher");
      expect(cfg.accessKey).toBe("minioadmin");
    });

    it("缺 access key 时抛错", () => {
      delete process.env.MINIO_ACCESS_KEY;
      expect(() => resolveStorageConfig()).toThrow(/MINIO_ACCESS_KEY/);
    });

    it("缺 secret key 时抛错", () => {
      delete process.env.MINIO_SECRET_KEY;
      expect(() => resolveStorageConfig()).toThrow(/MINIO_SECRET_KEY/);
    });

    it("bucket 缺省回退 ai-teacher", () => {
      delete process.env.MINIO_BUCKET;
      expect(getBucket()).toBe("ai-teacher");
    });
  });

  describe("buildSourceKey", () => {
    it("构造 sources/{sourceId}/{filename}", () => {
      expect(buildSourceKey("src_1", "doc.pdf")).toBe("sources/src_1/doc.pdf");
    });
  });

  describe("streamToBuffer", () => {
    it("聚合多 chunk 流为完整 Buffer", async () => {
      const stream = Readable.from([Buffer.from("hello,"), Buffer.from(" world")]);
      const buf = await streamToBuffer(stream);
      expect(buf.toString()).toBe("hello, world");
    });

    it("空流返回空 Buffer", async () => {
      const buf = await streamToBuffer(Readable.from([]));
      expect(buf.length).toBe(0);
    });
  });
});
