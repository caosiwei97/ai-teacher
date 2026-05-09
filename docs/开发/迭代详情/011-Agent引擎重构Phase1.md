# 011 — Agent 引擎重构 Phase 1

> 状态：✅ 已完成 | 分类：🟠 优化 | 优先级：P0 | 依赖：003
> 完成日期：2026-05-08

## 目标

建立 Agent 框架基础设施，工具副作用内化

## Checklist

- [x] 创建 `BaseAgent` 抽象基类（provider 统一 + 生命周期钩子）
- [x] 统一 Provider 创建（去掉 3 处重复）
- [x] 工具副作用内化（execute 做真实操作）
- [x] 创建 `NodeService` 封装节点操作
- [x] 创建 `MessageService` 封装消息持久化
- [x] 瘦身 `chat/route.ts`（移除 persistChatTurn）
- [x] RoadmapAgent / DiagnosticAgent 继承 BaseAgent
- [x] 验证：20/20 E2E 测试通过

## E2E 覆盖

全量回归测试：20/20 E2E 测试通过
