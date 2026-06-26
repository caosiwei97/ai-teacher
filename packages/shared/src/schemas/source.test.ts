import { describe, it, expect } from "vitest";
import { SourceType, SourceStatus, SourceRecord } from "./source";

describe("source schema", () => {
  describe("SourceType", () => {
    it("接受 pdf / markdown", () => {
      expect(SourceType.parse("pdf")).toBe("pdf");
      expect(SourceType.parse("markdown")).toBe("markdown");
    });

    it("拒绝非法值", () => {
      expect(() => SourceType.parse("url")).toThrow();
      expect(() => SourceType.parse("")).toThrow();
    });
  });

  describe("SourceStatus", () => {
    it("接受四种状态", () => {
      for (const s of ["pending", "processing", "ready", "failed"] as const) {
        expect(SourceStatus.parse(s)).toBe(s);
      }
    });

    it("拒绝非法状态", () => {
      expect(() => SourceStatus.parse("done")).toThrow();
    });
  });

  describe("SourceRecord", () => {
    const valid = {
      id: "src_1",
      userId: "u_1",
      title: "React 入门",
      type: "pdf",
      content: null,
      fileUrl: "minio://ai-teacher/sources/src_1/x.pdf",
      checksum: "sha256:abc",
      status: "ready",
      createdAt: "2026-06-26T00:00:00.000Z",
    };

    it("解析完整记录（可空字段为 null）", () => {
      const parsed = SourceRecord.parse(valid);
      expect(parsed.id).toBe("src_1");
      expect(parsed.status).toBe("ready");
      expect(parsed.content).toBeNull();
    });

    it("解析 URL 来源（type=markdown, fileUrl=http）", () => {
      const parsed = SourceRecord.parse({ ...valid, type: "markdown", fileUrl: "https://example.com/a" });
      expect(parsed.type).toBe("markdown");
    });

    it("拒绝缺必填字段", () => {
      const { id: _omit, ...noId } = valid;
      expect(() => SourceRecord.parse(noId)).toThrow();
    });

    it("拒绝非法 type / status", () => {
      expect(() => SourceRecord.parse({ ...valid, type: "docx" })).toThrow();
      expect(() => SourceRecord.parse({ ...valid, status: "ok" })).toThrow();
    });
  });
});
