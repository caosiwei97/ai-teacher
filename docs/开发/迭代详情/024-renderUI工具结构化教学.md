# 迭代 024：renderUI 工具 + 结构化教学组件

> 状态：✅ 已完成
> 完成日期：2026-05-10
> 来源：竞品调研后产品迭代规划

---

## 目标

Agent 可在对话中生成结构化教学组件（表格、对比卡、提示卡），让知识呈现更直观。

## Checklist

- [x] 新增 3 种 UIBlock schema（TableBlock、CalloutBlock、ComparisonCard）到 `packages/shared/src/schemas/ui-block.ts`
- [x] 新建 3 个渲染组件（table-block、callout-block、comparison-card）
- [x] 注册新 block type 到 UIBlockRegistry
- [x] 新建 renderUI 工具 `apps/worker/src/agent/tools/render-ui.ts`
- [x] 注册 renderUITool 到 `create-tools.ts`
- [x] 打通 SSE 管道：tutor-graph 发布 `ui-blocks` 事件
- [x] 前端 use-chat-stream 处理 `ui-blocks` 事件
- [x] 更新 tutor prompt 新增"结构化教学"章节
- [x] 更新文档（Prompt设计.md + 技术架构.md + 迭代计划.md + 开发日志.md）

## 代码变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/shared/src/schemas/ui-block.ts` | 修改 | 新增 3 种 schema + UIBlock 扩展 |
| `apps/web/src/components/ui-blocks/table-block.tsx` | 新建 | 表格渲染（amber header + 交替行 + inline code） |
| `apps/web/src/components/ui-blocks/callout-block.tsx` | 新建 | 提示卡（tip/warning/key 三种变体） |
| `apps/web/src/components/ui-blocks/comparison-card.tsx` | 新建 | 对比卡（A vs B 双列布局） |
| `apps/web/src/components/ui-blocks/registry.tsx` | 修改 | 注册 3 个新 block type |
| `apps/worker/src/agent/tools/render-ui.ts` | 新建 | renderUI ToolDefinition |
| `apps/worker/src/agent/tools/create-tools.ts` | 修改 | 注册 renderUITool |
| `apps/worker/src/graphs/tutor-graph.ts` | 修改 | renderUI tool-result → 发布 `ui-blocks` SSE 事件 |
| `apps/worker/src/agent/prompts/tutor.ts` | 修改 | 新增"结构化教学"prompt 章节 |
| `apps/web/src/hooks/use-chat-stream.ts` | 修改 | AnnotationData + uiBlocks 字段 + ui-blocks 事件处理 |

## 验证

- `pnpm build` 全量通过 ✅
- E2E 24/24 通过（12.7 秒）✅
