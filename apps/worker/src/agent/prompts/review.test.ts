import { describe, it, expect } from "vitest";
import { buildReviewSystemPrompt, type ReviewPromptContext } from "./review";

const baseCtx: ReviewPromptContext = {
  topic: "React Hooks",
  dueNodes: [
    { id: "n1", index: 0, title: "useState", description: "状态钩子", memoryStrength: 1.0, isOverdue: true },
    { id: "n2", index: 2, title: "useMemo", description: "记忆钩子", memoryStrength: 0.7, isOverdue: false },
  ],
  learnerProfile: "初学者",
};

describe("buildReviewSystemPrompt", () => {
  it("含考官角色 + 核心 section", () => {
    const prompt = buildReviewSystemPrompt(baseCtx);
    expect(prompt).toContain("# 角色");
    expect(prompt).toContain("考官");
    expect(prompt).toContain("# 核心规则");
    expect(prompt).toContain("# 复习产物");
    expect(prompt).toContain("# 今日复习清单");
    expect(prompt).toContain("# 工具调用规则");
  });

  it("核心原则：提取练习不重讲，答对放行答错才提示", () => {
    const prompt = buildReviewSystemPrompt(baseCtx);
    expect(prompt).toContain("不重讲");
    expect(prompt).toContain("答对");
    expect(prompt).toContain("答错");
  });

  it("到期清单列出 dueNodes（标题 + id + 强度）", () => {
    const prompt = buildReviewSystemPrompt(baseCtx);
    expect(prompt).toContain("useState");
    expect(prompt).toContain("useMemo");
    expect(prompt).toContain("n1");
    expect(prompt).toContain("n2");
  });

  it("工具规则提及 recordReviewResult", () => {
    const prompt = buildReviewSystemPrompt(baseCtx);
    expect(prompt).toContain("recordReviewResult");
  });

  it("无到期节点：提示清单为空但仍有效", () => {
    const prompt = buildReviewSystemPrompt({ ...baseCtx, dueNodes: [] });
    expect(prompt).toContain("今日复习清单");
    expect(prompt.length).toBeGreaterThan(0);
  });
});
