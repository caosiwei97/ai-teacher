import { describe, it, expect } from "vitest";
import { buildInterviewSystemPrompt, type InterviewPromptContext } from "./interview";

const baseCtx: InterviewPromptContext = {
  topic: "React Hooks",
  difficulty: "medium",
  streak: 1,
  questionCount: 2,
  masteredNodes: ["useState", "useEffect"],
};

describe("buildInterviewSystemPrompt", () => {
  it("含面试官角色 + 核心 section", () => {
    const prompt = buildInterviewSystemPrompt(baseCtx);
    expect(prompt).toContain("# 角色");
    expect(prompt).toContain("面试官");
    expect(prompt).toContain("# 核心规则");
    expect(prompt).toContain("# 难度档位");
    expect(prompt).toContain("# 当前面试状态");
    expect(prompt).toContain("# 工具调用规则");
  });

  it("全程不讲解只追问（spec §4.3 关键区别）", () => {
    const prompt = buildInterviewSystemPrompt(baseCtx);
    expect(prompt).toContain("不讲解");
    expect(prompt).toContain("追问");
  });

  it("三档难度说明（初级/中级/高级）", () => {
    const prompt = buildInterviewSystemPrompt(baseCtx);
    expect(prompt).toContain("初级");
    expect(prompt).toContain("中级");
    expect(prompt).toContain("高级");
  });

  it("注入当前难度 + 已掌握知识点（范围）+ 题数", () => {
    const prompt = buildInterviewSystemPrompt(baseCtx);
    expect(prompt).toContain("medium");
    expect(prompt).toContain("useState");
    expect(prompt).toContain("useEffect");
    expect(prompt).toContain("2"); // questionCount 或 masteredNodes 数量
  });

  it("工具规则提及 scoreAnswer + finalizeInterview", () => {
    const prompt = buildInterviewSystemPrompt(baseCtx);
    expect(prompt).toContain("scoreAnswer");
    expect(prompt).toContain("finalizeInterview");
  });
});
