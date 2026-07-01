import { describe, expect, it } from "vitest";
import {
  createFallbackInteractiveBlock,
  toolResultsHaveInteractiveBlock,
} from "./fallback-interactive";

describe("fallback interactive lesson", () => {
  it("为当前知识点生成可提交的兜底互动卡", () => {
    const block = createFallbackInteractiveBlock({
      id: "node-1",
      title: "货币的时间价值",
      description: "今天的一元钱比未来的一元钱更有价值。",
    });

    expect(block.type).toBe("interactive");
    expect(block.nodeId).toBe("node-1");
    expect(block.title).toContain("货币的时间价值");
    expect(block.quiz.correctId).toBe("a");
    expect(block.quiz.options.some((option) => option.id === "a")).toBe(true);
  });

  it("识别工具结果里是否已有 interactive block", () => {
    expect(
      toolResultsHaveInteractiveBlock([
        {
          toolName: "renderUI",
          result: {
            uiBlocks: [{ type: "heading", level: 2, text: "复利演示" }],
          },
        },
      ]),
    ).toBe(false);

    expect(
      toolResultsHaveInteractiveBlock([
        {
          toolName: "renderUI",
          result: {
            uiBlocks: [
              {
                type: "interactive",
                title: "复利",
                concept: "利滚利",
                explore: [],
                quiz: {
                  question: "复利关键是什么？",
                  options: [{ id: "a", text: "收益再投入" }],
                  correctId: "a",
                  explanation: "收益计入本金。",
                },
              },
            ],
          },
        },
      ]),
    ).toBe(true);
  });
});
