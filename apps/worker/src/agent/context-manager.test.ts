import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ModelMessage } from "ai";
import type { StructuredSummary } from "@ai-teacher/shared";

// mock 掉 compaction（含 LLM 调用），聚焦 context-manager 自身逻辑
const { mockGenerate, mockUpdate, mockFormat } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFormat: vi.fn(),
}));

vi.mock("./compaction", () => ({
  generateCompactSummary: mockGenerate,
  updateCompactSummary: mockUpdate,
  formatSummaryAsContext: mockFormat,
}));

import { ContextManager } from "./context-manager";

const mockSummary = {
  completedTopics: ["topic1"],
  masteryState: [],
  misconceptions: [],
  learningPreferences: {
    preferredExplanationStyle: "类比",
    pacePreference: "medium",
  },
  keyDecisions: [],
} as unknown as StructuredSummary;

function makeMessages(n: number): ModelMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i} 内容`,
  })) as ModelMessage[];
}

function makeCM(budget = 50) {
  const loadSummary = vi.fn();
  const saveSummary = vi.fn();
  const cm = new ContextManager({ loadSummary, saveSummary }, budget);
  return { cm, loadSummary, saveSummary };
}

describe("ContextManager", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    mockUpdate.mockReset();
    mockFormat.mockReset();
    mockGenerate.mockResolvedValue(mockSummary);
    mockFormat.mockReturnValue("[摘要]test");
  });

  describe("process", () => {
    it("未超阈值：compacted=false, needsCompaction=false", async () => {
      const { cm, loadSummary, saveSummary } = makeCM(50);
      const result = await cm.process("s1", makeMessages(2));

      expect(result.compacted).toBe(false);
      expect(result.needsCompaction).toBe(false);
      expect(result.summary).toBeNull();
      expect(result.messages).toHaveLength(2);
      expect(loadSummary).not.toHaveBeenCalled();
      expect(saveSummary).not.toHaveBeenCalled();
    });

    it("超阈值：触发 compact，调用 saveSummary", async () => {
      const { cm, loadSummary, saveSummary } = makeCM(50);
      loadSummary.mockResolvedValue(null);
      const result = await cm.process("s1", makeMessages(22));

      expect(result.compacted).toBe(true);
      expect(result.summary).toBe(mockSummary);
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(saveSummary).toHaveBeenCalledWith("s1", mockSummary);
    });

    it("compact 时 LLM 失败：回退到截断，不保存摘要", async () => {
      const { cm, loadSummary, saveSummary } = makeCM(50);
      loadSummary.mockResolvedValue(null);
      mockGenerate.mockRejectedValue(new Error("LLM down"));
      const result = await cm.process("s1", makeMessages(22));

      expect(result.compacted).toBe(false);
      expect(result.needsCompaction).toBe(false);
      expect(saveSummary).not.toHaveBeenCalled();
    });

    it("长消息截断（>2000 字符加 …[已截断]）", async () => {
      const { cm } = makeCM(10000);
      const longContent = "a".repeat(2001);
      const result = await cm.process("s1", [
        { role: "user", content: longContent } as ModelMessage,
      ]);

      const content = (result.messages[0] as { content: string }).content;
      expect(content.endsWith("…[已截断]")).toBe(true);
      expect(content).toHaveLength(2000 + "…[已截断]".length);
    });

    it("非 user/assistant 消息被过滤", async () => {
      const { cm } = makeCM(50);
      const result = await cm.process("s1", [
        { role: "system", content: "sys" } as ModelMessage,
        { role: "user", content: "hi" } as ModelMessage,
      ]);

      expect(result.messages).toHaveLength(1);
      expect((result.messages[0] as { role: string }).role).toBe("user");
    });
  });

  describe("prepareForStream", () => {
    it("超阈值 + existingSummary：注入 summary 消息，不触发压缩", async () => {
      const { cm, loadSummary } = makeCM(50);
      loadSummary.mockResolvedValue(mockSummary);
      const result = await cm.prepareForStream("s1", makeMessages(22));

      expect(result.needsCompaction).toBe(true);
      expect(result.summary).toBe(mockSummary);
      // 第一条是 summary 消息
      expect((result.messages[0] as { content: string }).content).toBe(
        "[摘要]test",
      );
      // prepareForStream 不调用压缩
      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });

  describe("compactAfterStream", () => {
    it("调用 saveSummary 保存新摘要", async () => {
      const { cm, loadSummary, saveSummary } = makeCM(50);
      loadSummary.mockResolvedValue(null);
      await cm.compactAfterStream("s1", makeMessages(22));

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(saveSummary).toHaveBeenCalledWith("s1", mockSummary);
    });
  });
});
