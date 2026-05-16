# AI Teacher

> 完整开发协议见 `AGENTS.md`，本文件为 Claude Code 精简版入口。

## Session 启动

新 session 开始时按顺序读取：

1. `docs/开发/开发日志.md` — 找到上次中断点
2. `docs/开发/迭代计划.md` — 当前迭代状态

恢复上下文后向用户确认工作起点再开始。

## 技术约束

- pnpm workspaces（不用 npm）
- 命名导出（不用 default export）
- 中文 UI 文本
- PostCSS 用 `module.exports`（不用 `export default`）
- .env 通过 symlink `apps/web/.env → ../../.env` 共享
- Tailwind CSS 4：颜色用 `@theme` CSS 变量，不用硬编码色值
- LLM：DeepSeek（@ai-sdk/deepseek），默认 `deepseek-v4-flash`
- 端口：Web 38421, Server 38422, Worker 38423, PG 25432, Redis 26379, MinIO 29000/29001, OpenSandbox 2358

## 项目结构

```
apps/
  web/          — Vite + React 19 (SPA) + Chat UI
  server/       — Hono API Server (REST API + SSE)
  worker/       — Agent Worker (BullMQ + AI SDK streamText + 11 tools)
packages/
  shared/       — Zod schemas, types
  db/           — Prisma schema + seed
docker-compose.yml  — PG + Redis + MinIO + OpenSandbox
e2e/            — Playwright E2E tests
docs/           — 项目文档（中文）
```

## 开发规范

- 动手实现前先 Review 迭代方案：读迭代详情 → 对照实际代码审查完整性 → 报告遗漏/风险 → 确认后才动手
- 代码变更前读取 `.agents/references/文档同步规则.md` 评估文档影响
- 涉及 UI/API/路由变更时读取 `.agents/references/质量门控.md` 检查 E2E
- 涉及 CSS/env/config/prisma 变更时读取 `.agents/references/缓存与重启.md`
- 大范围改动（3+ 文件）时读取 `.agents/references/大改动讨论.md`，先讨论方案再动手
- 开发日志详情必须同步到 `docs/开发/开发日志/YYYY/MM/DD.md`，归档目录表链接不能为 `—`
- 子 Agent 只做代码实现，不修改 `docs/` 目录

## 意图路由

| 类型 | 策略 |
|------|------|
| 产品需求 | 讨论方案 → 确认 → 实现 → 同步文档 + E2E |
| 问题修复 | 最小化修复 → 记录日志 |
| 技术改进 | 先讨论确认再执行 → ADR 记录 |
| 探索调研 | 只读不改代码 → 记录结论 |

## Session 结束

1. 更新 `docs/开发/开发日志.md` — 记录本次工作
2. 更新 `docs/开发/迭代计划.md` — 同步迭代状态
3. 确认文档与代码一致
4. 日志末尾标注下次 session 应从哪里继续
