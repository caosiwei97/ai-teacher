import { describe, it, expect } from "vitest";
import { buildTutorSystemPrompt, type TutorPromptContext } from "./tutor";

const baseCtx: TutorPromptContext = {
  topic: "React Hooks",
  currentNode: { id: "n1", title: "useState", description: "状态钩子" },
  allNodes: [
    { id: "n1", index: 0, title: "useState", status: "in_progress" },
    { id: "n2", index: 1, title: "useEffect", status: "not_started" },
  ],
  masteredNodes: "无",
  learnerProfile: "初学者",
};

describe("buildTutorSystemPrompt", () => {
  it("基础：包含各核心 section", () => {
    const prompt = buildTutorSystemPrompt(baseCtx);
    expect(prompt).toContain("# 角色");
    expect(prompt).toContain("# 当前教学上下文");
    expect(prompt).toContain("# 知识图谱节点");
    expect(prompt).toContain("# 追问策略");
    expect(prompt).toContain("# 工具调用规则");
  });

  it("默认 teachingMode（undefined）为温暖私教", () => {
    const prompt = buildTutorSystemPrompt(baseCtx);
    expect(prompt).toContain("温暖私教");
  });

  it("teachingMode=strict：严格教练", () => {
    const prompt = buildTutorSystemPrompt({ ...baseCtx, teachingMode: "strict" });
    expect(prompt).toContain("严格教练");
    expect(prompt).not.toContain("温暖私教");
  });

  it("isDiagnosisPhase=true：包含诊断阶段 section", () => {
    const prompt = buildTutorSystemPrompt({ ...baseCtx, isDiagnosisPhase: true });
    expect(prompt).toContain("# 诊断阶段");
  });

  it("isDiagnosisPhase 不设：不含诊断阶段", () => {
    const prompt = buildTutorSystemPrompt(baseCtx);
    expect(prompt).not.toContain("# 诊断阶段");
  });

  it("sandboxModel 注入到核心规则", () => {
    const prompt = buildTutorSystemPrompt({
      ...baseCtx,
      sandboxModel: "custom-model-xyz",
    });
    expect(prompt).toContain("custom-model-xyz");
  });

  it("currentNode.id 出现在工具调用规则", () => {
    const prompt = buildTutorSystemPrompt(baseCtx);
    expect(prompt).toContain("n1");
    expect(prompt).toContain("useState");
  });

  it("说明互动课完成隐藏消息会触发掌握评估", () => {
    const prompt = buildTutorSystemPrompt(baseCtx);
    expect(prompt).toContain("[Interactive Response]");
    expect(prompt).toContain("优先调用 assessMastery");
    expect(prompt).toContain("不要重新生成同一张互动课");
  });
});
