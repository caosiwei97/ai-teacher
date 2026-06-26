import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { embedTexts, getEmbeddingDimensions } from "./embedding";

describe("embedding", () => {
  const origMock = process.env.MOCK_LLM;
  const origDim = process.env.EMBEDDING_DIMENSIONS;

  beforeEach(() => {
    process.env.MOCK_LLM = "true";
    delete process.env.EMBEDDING_DIMENSIONS;
  });

  afterEach(() => {
    if (origMock === undefined) delete process.env.MOCK_LLM;
    else process.env.MOCK_LLM = origMock;
    if (origDim === undefined) delete process.env.EMBEDDING_DIMENSIONS;
    else process.env.EMBEDDING_DIMENSIONS = origDim;
  });

  describe("getEmbeddingDimensions", () => {
    it("缺省 1024", () => {
      expect(getEmbeddingDimensions()).toBe(1024);
    });

    it("读取环境变量", () => {
      process.env.EMBEDDING_DIMENSIONS = "768";
      expect(getEmbeddingDimensions()).toBe(768);
    });
  });

  describe("embedTexts（MOCK_LLM 合成向量）", () => {
    it("空输入返回空数组", async () => {
      expect(await embedTexts([])).toEqual([]);
    });

    it("返回 1024 维向量", async () => {
      const [vec] = await embedTexts(["测试"]);
      expect(vec).toHaveLength(1024);
    });

    it("L2 归一化（norm ≈ 1）", async () => {
      const [vec] = await embedTexts(["归一化测试"]);
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1, 5);
    });

    it("确定性：相同输入产生相同向量", async () => {
      const [a] = await embedTexts(["相同的文本"]);
      const [b] = await embedTexts(["相同的文本"]);
      expect(a).toEqual(b);
    });

    it("不同输入产生不同向量", async () => {
      const [a] = await embedTexts(["苹果"]);
      const [b] = await embedTexts(["香蕉"]);
      expect(a).not.toEqual(b);
    });
  });
});
