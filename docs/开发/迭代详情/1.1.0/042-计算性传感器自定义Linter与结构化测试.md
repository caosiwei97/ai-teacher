# 迭代 042：计算性传感器 — 自定义 Linter + 结构化测试

> 优先级：P0 | 分类：优化 | 状态：⬜ 待开始
> E2E：无新增（内部基础设施）

## 不足点

当前项目的所有质量门禁都是**推断性（inferential）**的——依赖 AI 自觉遵守 AGENTS.md 和 references/ 中的规则。没有计算性（computational）传感器来自动化执行这些规则。

**具体表现：**
- 文档-代码一致性检查靠 AI "看一眼"，不是脚本 diff
- 命名导出规范写在 AGENTS.md 里，但没有 ESLint 规则强制
- Agent 工具参数的 Zod Schema 只在运行时校验，没有静态检查
- Prisma Schema 的 enum 字段用了 String 类型，没有迁移到原生 Enum

**参考资料来源：**
- Martin Fowler《Harness engineering for coding agent users》（2026.04）：提出 computational vs inferential 二分法——computational sensors（linter、type checker、structural test）确定性高、速度快、成本低，应作为第一道防线
- OpenAI《Harness engineering: leveraging Codex in an agent-first world》（2026）：自定义 linter 强制分层依赖方向，linter 错误信息包含 AI 可消费的修复指令——"a positive kind of prompt injection"
- LangChain《The Anatomy of an Agent Harness》（2026.03）：hooks/middleware for deterministic execution 作为 Harness 核心组件

## 目标

1. 建立计算性传感器体系，把 AGENTS.md 中的关键规则从"AI 自觉遵守"升级为"工具强制执行"
2. 自定义 ESLint 规则强制命名导出、禁止 default export
3. 结构化测试（ArchUnit 风格）校验模块依赖方向
4. Linter 错误信息包含对 AI 友好的修复提示

## 可优化方向

### 1. 自定义 ESLint 规则

| 规则 | 检查内容 | 错误信息（含 AI 修复提示） |
|------|---------|------------------------|
| `no-default-export` | 禁止 `export default` | "Use named export instead. See AGENTS.md §4: 命名导出（不用 default export）" |
| `consistent-type-imports` | 强制 `import type` | "Use `import type { X }` for type-only imports" |
| `no-hardcoded-colors` | CSS 中禁止硬编码色值 | "Use Tailwind CSS 4 `@theme` variables. See .agents/references/缓存与重启.md" |

### 2. 模块依赖方向测试

```
apps/web/src/    → 只能 import packages/shared/, 不能 import apps/server/ 或 apps/worker/
apps/server/src/ → 只能 import packages/shared/, packages/db/
apps/worker/src/ → 只能 import packages/shared/, packages/db/
packages/shared/ → 不能 import 任何其他包
packages/db/     → 不能 import apps/ 或 packages/shared/
```

用 TypeScript path alias + 自定义脚本或 dependency-cruiser 校验。

### 3. Prisma Schema Enum 迁移

将 `Session.status`、`Node.status`、`Message.role`、`Message.type` 等 String 字段迁移为 Prisma Enum，获得编译时类型安全。

## 实施步骤

### Phase 1：ESLint 自定义规则

1. 创建 `scripts/eslint-rules/` 目录
2. 实现 `no-default-export` 规则
3. 在 `.eslintrc` 或 `eslint.config.js` 中启用
4. 修复现有违规

### Phase 2：依赖方向测试

1. 安装 `dependency-cruiser`
2. 创建 `.dependency-cruiser.js` 配置，定义合法依赖方向
3. 添加 `pnpm check:deps` 命令
4. 在 `质量门控.md` 中加入 commit 前检查

### Phase 3：Prisma Enum 迁移

1. 在 `schema.prisma` 中定义 Enum 类型
2. 生成迁移文件
3. 更新 Zod Schema 和 TypeScript 类型
4. 更新 `docs/设计/技术架构.md` 数据模型章节

## 验收标准

- [ ] ESLint `no-default-export` 规则已启用，无违规
- [ ] dependency-cruiser 配置完成，`pnpm check:deps` 通过
- [ ] Prisma Schema 中至少 3 个 String 状态字段迁移为 Enum
- [ ] `docs/设计/技术架构.md` 数据模型章节已同步
- [ ] `质量门控.md` 已更新，新增 `pnpm check:deps` 检查项

## 风险

- Prisma Enum 迁移需要数据库 migration，需确认无数据损失
- dependency-cruiser 配置可能在 monorepo 场景下需要调试路径解析

## E2E 影响

无新增 E2E（纯内部基础设施变更）
