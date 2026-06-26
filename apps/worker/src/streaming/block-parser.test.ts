import { describe, it, expect } from "vitest";
import { StreamingBlockParser } from "./block-parser";

describe("StreamingBlockParser", () => {
  function makeParser() {
    const blocks: unknown[] = [];
    const parser = new StreamingBlockParser({
      onBlock: (b) => blocks.push(b),
    });
    return { parser, blocks };
  }

  it("完整数组一次 feed：emit 每个 block + index 递增", () => {
    const seen: Array<{ block: unknown; index: number }> = [];
    const parser = new StreamingBlockParser({
      onBlock: (block, index) => seen.push({ block, index }),
    });
    parser.feed(
      JSON.stringify([
        { type: "text", content: "a" },
        { type: "text", content: "b" },
      ]),
    );
    expect(seen).toHaveLength(2);
    expect(seen[0].block).toEqual({ type: "text", content: "a" });
    expect(seen[0].index).toBe(0);
    expect(seen[1].index).toBe(1);
  });

  it("流式逐字符 feed：同样 emit", () => {
    const { parser, blocks } = makeParser();
    const json = JSON.stringify([{ type: "text", content: "x" }]);
    for (const ch of json) parser.feed(ch);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: "text", content: "x" });
  });

  it("不完整 JSON（feed 一半）：不提前 emit", () => {
    const { parser, blocks } = makeParser();
    parser.feed('[{"type":"text","content":"partial"');
    expect(blocks).toHaveLength(0);
  });

  it("字符串中的 {}[] 不误触发", () => {
    const { parser, blocks } = makeParser();
    parser.feed(
      JSON.stringify([{ type: "code", content: "if (x) { y = [1,2] }" }]),
    );
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { content: string }).content).toBe(
      "if (x) { y = [1,2] }",
    );
  });

  it("转义引号不破坏字符串解析", () => {
    const { parser, blocks } = makeParser();
    parser.feed(
      JSON.stringify([{ type: "text", content: 'he said "hi" back' }]),
    );
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { content: string }).content).toBe('he said "hi" back');
  });

  it("malformed JSON：不 emit 不崩溃", () => {
    const { parser, blocks } = makeParser();
    parser.feed("[{not valid json}]");
    expect(blocks).toHaveLength(0);
  });

  it("flush 在正常解析后不重复 emit", () => {
    const { parser, blocks } = makeParser();
    parser.feed(JSON.stringify([{ type: "text", content: "a" }]));
    parser.flush();
    expect(blocks).toHaveLength(1);
  });

  it("无 type 字段的对象不 emit", () => {
    const { parser, blocks } = makeParser();
    parser.feed(JSON.stringify([{ content: "no type" }]));
    expect(blocks).toHaveLength(0);
  });

  it("数组外的字符被忽略（找到 [ 才开始）", () => {
    const { parser, blocks } = makeParser();
    parser.feed('garbage before[{"type":"text","content":"a"}]');
    expect(blocks).toHaveLength(1);
  });

  it("嵌套对象（block 内含嵌套 {}）：正确 emit 整体", () => {
    const { parser, blocks } = makeParser();
    parser.feed(
      JSON.stringify([
        { type: "assessment", items: [{ q: "a" }, { q: "b" }], meta: { k: 1 } },
      ]),
    );
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { items: unknown[] }).items).toEqual([
      { q: "a" },
      { q: "b" },
    ]);
  });
});
