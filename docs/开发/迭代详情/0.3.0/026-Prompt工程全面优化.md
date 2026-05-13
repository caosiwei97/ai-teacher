# 迭代 026：Prompt 工程全面优化

> 状态：⬜ 待开始
> 优先级：P0
> 依赖：迭代 024（renderUI），迭代 025（pushCode）
> 来源：竞品调研发现 5 个结构性差距

---

## 目标

修复 Prompt 策略的 5 个结构性问题，增加教学模式切换，让教学效果从"能用"提升到"好用"。

## 五个核心变更

### 1. assessMastery 改为非每轮强制

**现状**：prompt 写死"每轮对话后必须调用 assessMastery"，导致机械打分、浪费 token。
**改为**：每 2-3 轮充分互动后才评估，或让 Agent 自主判断。

**文件**：`apps/worker/src/agent/prompts/tutor.ts` + `apps/worker/src/agent/tools/assess-mastery.ts`

### 2. recordStrength / recordMisconception 实际持久化

**现状**：两个工具的 execute 函数只返回 `{success: true}`，没有写数据库。
**改为**：写入 LearnerProfile 的 strengths/weaknesses。

**文件**：
- `apps/worker/src/agent/tools/record-strength.ts` — 持久化到 LearnerProfile
- `apps/worker/src/agent/tools/record-misconception.ts` — 持久化到 LearnerProfile
- 可能需要修改 Prisma schema 增加结构化字段

### 3. 教学模式作为核心策略切换

**现状**：只有一种固定教学模式。
**改为**：温暖私教 vs 严格教练，是**教学策略差异**，不只是语气。

| 维度 | 温暖私教 | 严格教练 |
|------|---------|---------|
| 回答"对了" | 肯定推进 | 追问底层逻辑 |
| 表面正确 | 接受继续 | 拒绝，要求深层解释 |
| 追问策略 | 1-2 轮就总结 | 3-4 轮反复验证 |
| 掌握门槛 | ~80% | ~85% + 理解"为什么" |

**文件**：
- `apps/worker/src/agent/prompts/tutor.ts` — prompt 模板化
- Session 创建时选择教学模式 → 存入 DB
- 前端首页/诊断页新增教学模式选择 UI

### 4. 使用 ToolRegistry.toPromptSection() 动态注入

**现状**：工具说明在 prompt 模板中硬编码，每个工具的 `promptSnippet` 从未被使用。
**改为**：删除硬编码的工具说明，改为 `toPromptSection()` 动态收集。

**文件**：
- `apps/worker/src/graphs/tutor-graph.ts` — 调用 `registry.toPromptSection()`
- `apps/worker/src/agent/prompts/tutor.ts` — 移除硬编码工具说明

### 5. 增强 stopWhen 逻辑

**现状**：`stopWhen: stepCountIs(3)`，assessMastery → generateAssessment → advanceNode 三连刚好用完额度，新增 renderUI/pushCode 后更紧张。
**改为**：`stepCountIs(5)` 或按工具类型动态调整。

**文件**：`apps/worker/src/graphs/tutor-graph.ts`

## Checklist

- [ ] 修改 `apps/worker/src/agent/prompts/tutor.ts` — 教学模式模板化 + 移除硬编码工具说明
- [ ] 修改 `apps/worker/src/graphs/tutor-graph.ts` — toPromptSection() + stopWhen(5)
- [ ] 修改 `apps/worker/src/agent/tools/assess-mastery.ts` — 调整 promptSnippet
- [ ] 修改 `apps/worker/src/agent/tools/record-strength.ts` — 实际持久化
- [ ] 修改 `apps/worker/src/agent/tools/record-misconception.ts` — 实际持久化
- [ ] 可能修改 Prisma schema — Session 新增 teachingMode 字段
- [ ] 前端新增教学模式选择 UI（首页或诊断页）
- [ ] 更新文档

## 关键注意事项

- recordStrength/recordMisconception 的持久化需要 LearnerProfile 写入，参考 `apps/worker/src/agent/services/profile-service.ts` 的去重合并逻辑
- 教学模式影响 prompt 策略，不是简单的 system prompt 拼接——两种模式在追问深度、通过门槛、提示频率上有本质差异
- toPromptSection() 方法已存在于 `packages/agent/src/tool-registry.ts`，只是从未被调用
- 这个迭代改动范围集中在 prompt 层，不涉及前端 UI 组件（教学模式选择 UI 可能需要独立拆分）
