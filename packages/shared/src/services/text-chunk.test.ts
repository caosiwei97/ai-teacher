import { describe, it, expect } from "vitest";
import { chunkText } from "./text-chunk";

describe("chunkText", () => {
  it("空字符串返回空数组", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  \t ")).toEqual([]);
  });

  it("短文本（< maxChars）返回单个 chunk", () => {
    const chunks = chunkText("这是一段简短文本。");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("这是一段简短文本。");
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("长文本按 maxChars 滑窗切分", () => {
    const long = "字".repeat(1200); // 1200 字，单段
    const chunks = chunkText(long, { maxChars: 500, overlap: 100 });
    // 步长 = 500-100 = 400；1200 字 → ceil((1200-500)/400)+1 = 3 段
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // 每个 chunk 不超 maxChars
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(500);
    }
    // index 连续
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("overlap 使相邻 chunk 共享尾部/头部内容", () => {
    const long = "ABCDEFGHIJ".repeat(200); // 2000 字符
    const chunks = chunkText(long, { maxChars: 500, overlap: 100 });
    // 第 0 chunk 末尾 100 字符应出现在第 1 chunk 开头
    const tail = chunks[0].content.slice(-100);
    expect(chunks[1].content.startsWith(tail)).toBe(true);
  });

  it("多段落短文本 → 每段一个 chunk", () => {
    const text = "第一段内容。\n\n第二段内容。\n\n第三段内容。";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toBe("第一段内容。");
    expect(chunks[2].content).toBe("第三段内容。");
  });

  it("overlap >= maxChars 时仍能推进（不死循环）", () => {
    const long = "字".repeat(2000);
    const chunks = chunkText(long, { maxChars: 100, overlap: 150 });
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(100);
  });

  it("trim 去除首尾空白", () => {
    const chunks = chunkText("  \n有内容的文本  \n");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("有内容的文本");
  });
});
