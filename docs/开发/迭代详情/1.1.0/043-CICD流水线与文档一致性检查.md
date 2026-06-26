# 迭代 043：CI/CD 流水线 + 自动化文档一致性检查

> 优先级：P0 | 分类：基础设施 | 状态：✅ 已完成（2026-06-26）
> E2E：无新增（CI 基础设施）

## 不足点

项目没有任何 CI/CD 配置。所有质量检查（build、lint、test）都在本地手动执行，依赖开发者自觉。这意味着：

- 代码可以在 build 失败的状态下被推送
- 文档和代码的同步没有自动化保障
- E2E 测试只在发版时手动跑，日常变更可能引入回归

**参考资料来源：**

- Martin Fowler《Harness engineering for coding agent users》（2026.04）：强调 "Keep quality left"——检查越靠近代码变更时间点，修复成本越低。computational sensors 应分布在开发生命周期的不同阶段
- OpenAI Codex 团队实践：dedicated CI jobs validate that knowledge base is up to date, cross-linked, and structured correctly；recurring "doc-gardening" agent 扫描过时文档并自动开 PR
- Martin Fowler 引用 Stripe 实践：pre-push hooks that run relevant linters based on a heuristic，强调 "shift feedback left"
- GitHub Actions 文档：TypeScript monorepo CI 最佳实践

## 目标

1. 建立 GitHub Actions CI 流水线
2. 自动化文档-代码一致性检查（最重要的一个：Prisma Schema ↔ 技术架构.md）
3. build + lint 在每次 PR 时自动运行
4. 为 E2E 测试的 CI 运行建立基础

## 可优化方向

### 1. GitHub Actions 流水线设计

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]

jobs:
  build:
    - pnpm install
    - pnpm build # 全量构建检查

  lint:
    - pnpm lint # ESLint（含迭代 042 的自定义规则）
    - pnpm check:deps # 依赖方向检查（迭代 042）

  doc-consistency:
    - pnpm check:docs # 文档-代码一致性检查（本次新增）


  # E2E（可选，需要 Docker 环境）
  # e2e:
  #   - pnpm docker:up
  #   - pnpm test:e2e
```

### 2. 文档一致性检查脚本

| 检查项                                | 方法                                                                            | 期望结果       |
| ------------------------------------- | ------------------------------------------------------------------------------- | -------------- |
| Prisma Schema ↔ 技术架构.md           | 提取文档中 ` ```prisma ``` ` 代码块，与 `packages/db/prisma/schema.prisma` diff | 完全一致       |
| .env.example ↔ 技术架构.md 环境变量表 | 解析 .env.example 的 KEY 列表，与文档表格 diff                                  | KEY 列表一致   |
| API 路由文件 ↔ API接口.md             | 列出 `apps/server/src/routes/*.ts`，与文档中的路由列表对比                      | 数量和名称一致 |
| Agent 工具 ↔ Prompt设计.md            | 列出 `apps/worker/src/agent/tools/*.ts`（排除 index.ts），与文档工具定义对比    | 数量和名称一致 |
| 端口表 ↔ README.md + 技术架构.md      | 检查两处端口表是否一致                                                          | 完全一致       |

### 3. Pre-commit Hook（可选但推荐）

用 `lint-staged` + `husky` 在 commit 前自动运行：

- `eslint --fix`（已修改的 .ts 文件）
- `prettier --write`（已修改的 .md/.css 文件）

## 实施步骤

### Phase 1：文档一致性检查脚本

1. 创建 `scripts/check-doc-consistency.ts`
2. 实现 5 项检查（Prisma、env、API、工具、端口）
3. 添加 `pnpm check:docs` 命令到 `package.json`
4. 在 `质量门控.md` 中新增 `pnpm check:docs` 检查项

### Phase 2：GitHub Actions CI

1. 创建 `.github/workflows/ci.yml`
2. 配置 build + lint + doc-consistency 三个 job
3. 配置 Node.js 20 + pnpm 缓存
4. 测试 CI 在 PR 场景下正常运行

### Phase 3：Pre-commit Hook（可选）

1. 安装 `husky` + `lint-staged`
2. 配置 `package.json` 中的 lint-staged 规则
3. 测试 commit 前自动检查

## 验收标准

- [x] `pnpm check:docs` 命令可用，5 项检查全部通过
- [x] `.github/workflows/ci.yml` 已创建，push/PR 时自动运行
- [x] CI 中 typecheck + test:unit + check:docs + build 全绿（lint 推迟 042，本地各步验证全过）
- [x] `质量门控.md` 已更新，新增文档一致性检查 + CI 说明
- [x] 如果 Prisma Schema 或 API 路由变更但文档未同步，`pnpm check:docs` 会报错

## 风险

- GitHub Actions 免费额度对私有仓库有限制（本项目目前 public，无影响）
- 文档一致性检查可能产生误报（如文档中故意用简化版 schema），需要设计白名单机制
- CI 运行时间需控制在 5 分钟内

## E2E 影响

无新增 E2E（CI 基础设施）
