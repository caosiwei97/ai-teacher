# 迭代 045：Agent 核心逻辑单元测试

> 优先级：P0 | 分类：优化 | 状态：⬜ 待开始
> E2E：无新增（单元测试覆盖）

## 不足点

项目有 50 个 E2E 测试覆盖用户流程，但**零单元测试**。以下核心逻辑完全未经单元级验证：

| 模块 | 风险 | 为什么需要单元测试 |
|------|------|-------------------|
| `assess-mastery.ts` | 掌握度评估直接影响学习进度推进，逻辑错误会导致用户卡住或跳过 | 掌握度门控是教学核心，评分逻辑需要精确测试 |
| `context-manager.ts` | 上下文压缩决定 AI 能看到什么，压缩错误会丢失关键教学状态 | 上下文管理是 Agent 长期运行的关键 |
| `compaction.ts` | 结构化摘要生成的准确性 | 摘要质量直接影响后续教学质量 |
| `tutor.ts`（Prompt 组装） | Pipeline 各 section 的条件注入逻辑 | 确保 diagnosis section 只在新会话注入、教学模式正确切换 |
| `block-parser.ts` | UIBlock 流式解析的边界情况 | 解析错误导致 UI 渲染异常 |
| `node-service.ts` | 节点推进、掌握度更新、自动过渡 | 数据一致性关键路径 |
| `crypto.ts` | API Key 加解密 | 安全关键 |
| Zod Schema（packages/shared） | 运行时校验 | 边界值、缺失字段、类型错误 |

**参考资料来源：**
- Martin Fowler《Harness engineering for coding agent users》（2026.04）："Computational sensors catch the structural stuff reliably: duplicate code, cyclomatic complexity, missing test coverage, architectural drift. These are cheap, proven, and deterministic."
- OpenAI Codex 团队实践：mutation testing 和 structural testing 正在复兴，作为 computational feedback sensors
- Martin Fowler："mutation testing" 和 "structural tests"（如 ArchUnit）是 underused 但对 AI 生成代码尤其重要的检查手段

## 目标

1. 建立单元测试基础设施（Vitest）
2. 对 6 个核心模块编写单元测试
3. 达到关键路径 80%+ 覆盖率

## 可优化方向

### 1. 测试框架选型

| 选项 | 优点 | 缺点 |
|------|------|------|
| **Vitest**（推荐） | 与 Vite 共享配置、ESM 原生支持、速度快 | 需要安装 |
| Jest | 成熟、社区大 | ESM 支持需要额外配置，与 Vite 配置不共享 |

### 2. 测试优先级矩阵

| 优先级 | 模块 | 测试重点 | 预估用例数 |
|--------|------|---------|-----------|
| P0 | `crypto.ts` | 加密/解密往返、空输入、非法输入 | 5 |
| P0 | `node-service.ts` | 掌握度更新（<80 不推进、≥80 推进、全部掌握）、自动过渡逻辑 | 8 |
| P0 | `assess-mastery.ts` | 评分逻辑、gaps/misconceptions 记录、instruction 字段生成 | 6 |
| P1 | `block-parser.ts` | 完整 UIBlock 解析、流式增量输入、不完整 JSON 处理、多 block 序列 | 10 |
| P1 | `tutor.ts`（Prompt 组装） | 各 section 条件注入、教学模式切换、诊断阶段检测 | 8 |
| P1 | `context-manager.ts` | 消息截断、token 估算、压缩触发 | 6 |
| P2 | Zod Schema（shared） | 边界值、缺失字段、类型错误 | 15 |
| P2 | `compaction.ts` | 摘要生成、增量更新 | 4 |

### 3. Mock 策略

- LLM 调用：mock `streamText` / `generateObject`，返回预设结果
- Prisma：mock `PrismaClient`，避免真实 DB 依赖
- Redis：mock `BullMQ` publisher

## 实施步骤

### Phase 1：基础设施

1. 安装 `vitest` 及 `@vitest/coverage-v8`
2. 创建 `vitest.config.ts`（共享 `tsconfig.base.json`）
3. 添加 `pnpm test:unit` 和 `pnpm test:coverage` 命令
4. 在 `质量门控.md` 中新增 `pnpm test:unit` 检查项

### Phase 2：P0 测试

1. 编写 `crypto.ts` 单元测试
2. 编写 `node-service.ts` 单元测试（mock Prisma）
3. 编写 `assess-mastery.ts` 单元测试（mock DB + LLM）

### Phase 3：P1 测试

1. 编写 `block-parser.ts` 单元测试
2. 编写 `tutor.ts` Prompt 组装测试
3. 编写 `context-manager.ts` 测试

### Phase 4：CI 集成

1. 在 GitHub Actions CI 中新增 `test-unit` job
2. 配置覆盖率报告（可选：Codecov）

## 验收标准

- [ ] Vitest 已安装配置，`pnpm test:unit` 可运行
- [ ] `crypto.ts`、`node-service.ts`、`assess-mastery.ts` 有完整单元测试
- [ ] `block-parser.ts`、`tutor.ts`、`context-manager.ts` 有基本单元测试
- [ ] 关键路径覆盖率 ≥ 80%
- [ ] `质量门控.md` 已更新，新增 `pnpm test:unit` 检查项
- [ ] CI 流水线包含单元测试 job

## 风险

- mock Prisma/Redis 的初始化成本较高
- 部分模块（如 `compaction.ts`）内部依赖 LLM，mock 需要仔细设计
- 测试文件的组织方式需与 monorepo 结构对齐

## E2E 影响

无（单元测试与 E2E 正交）
