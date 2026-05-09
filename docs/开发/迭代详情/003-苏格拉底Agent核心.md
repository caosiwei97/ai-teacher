# 003 — 苏格拉底追问 Agent 核心

> 状态：✅ 已完成 | 分类：🔵 功能 | 优先级：P0 | 依赖：002
> 完成日期：2026-05-08

## 目标

实现苏格拉底式追问 Agent 核心（AI SDK streamText + tool calling）

## Checklist

- [x] Tutor Agent system prompt 设计
- [x] Agent Loop 实现（AI SDK streamText + tool calling）
- [x] 掌握度评估工具（assessMastery）
- [x] 知识点追踪工具（recordStrength / recordMisconception）
- [x] 评估卡片工具（generateAssessment）
- [x] 节点推进工具（advanceNode）
- [x] 上下文管理（当前节点 + allNodes + 已掌握节点 + 学习者画像）
- [x] 流式响应（SSE）

## E2E 覆盖

| E2E 分类 | 测试文件 | 关键用例 ID |
|---------|---------|------------|
| C. 苏格拉底式教学循环 | `e2e/chat.spec.ts`, `e2e/learn.spec.ts` | E2E-C01 ~ E2E-C05 |
| J. 流式响应与性能 | `e2e/chat.spec.ts` | E2E-J01, E2E-J02 |
