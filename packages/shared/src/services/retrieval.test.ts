import { describe, it, expect } from "vitest";
import { toVectorLiteral } from "./retrieval";

describe("retrieval", () => {
  describe("toVectorLiteral", () => {
    it("数值向量 → pgvector 文本字面量", () => {
      expect(toVectorLiteral([1, 2, 3])).toBe("[1,2,3]");
      expect(toVectorLiteral([0.5, -0.1, 2.3])).toBe("[0.5,-0.1,2.3]");
    });

    it("单元素向量", () => {
      expect(toVectorLiteral([42])).toBe("[42]");
    });

    it("浮点数保留精度", () => {
      expect(toVectorLiteral([1.23456789])).toBe("[1.23456789]");
    });
  });
});
