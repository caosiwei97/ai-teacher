# 迭代 046：Prisma Schema 索引策略 + 类型优化

> 优先级：P2 | 分类：优化 | 状态：⬜ 待开始
> E2E：无新增

## 不足点

当前 Prisma Schema 有两类问题：

**1. 缺少索引：** 除了 Checkpoint 的 `[sessionId, createdAt]` 复合索引和 LlmConfig 的 `[userId]` 索引外，其他高频查询路径没有显式索引。随着数据量增长：
- `Session` 按 `userId + status` 查询（会话列表按状态分组）无索引
- `Message` 按 `sessionId + createdAt` 查询（加载历史消息）无索引
- `Node` 按 `roadmapId + index` 查询（按顺序获取节点）无索引

**2. String 代替 Enum：** 多个状态字段使用 `@db.Text` 而非 Prisma Enum，缺少编译时类型安全：
- `Session.status`（"active" | "completed" | "archived"）
- `Session.teachingMode`（"warm" | "strict" | "interviewer"）
- `Node.status`（"not-started" | "in-progress" | "mastered"）
- `Message.role`（"user" | "assistant" | "system"）
- `Message.type`（"text" | "tool-call" | "tool-result" | "ui-block"）
- `Source.type`（"pdf" | "markdown" | "url"）

**参考资料来源：**
- Prisma 官方文档：Index and Performance Optimization
- Prisma 官方文档：Native Enums vs String Enums 的权衡
- PostgreSQL 索引最佳实践：高频查询路径应覆盖复合索引

## 目标

1. 为高频查询路径添加数据库索引
2. 将状态字段从 String 迁移为 Prisma Enum
3. 在 Zod Schema 和 TypeScript 类型中同步使用 Enum

## 可优化方向

### 1. 索引添加

```prisma
model Session {
  // ...
  @@index([userId, status])        // 会话列表按状态分组查询
  @@index([userId, updatedAt])     // 最近更新的会话
}

model Message {
  // ...
  @@index([sessionId, createdAt])  // 历史消息按时间加载
}

model Node {
  // ...
  @@index([roadmapId, index])      // 按顺序获取节点
  @@index([roadmapId, status])     // 按状态筛选节点
}

model Source {
  // ...
  @@index([userId])                // 用户的学习资料列表
}
```

### 2. Enum 定义

```prisma
enum SessionStatus {
  active
  completed
  archived
}

enum TeachingMode {
  warm
  strict
  interviewer
}

enum NodeStatus {
  not_started    // Prisma enum 不支持 hyphen
  in_progress
  mastered
}

enum MessageRole {
  user
  assistant
  system
}

enum MessageType {
  text
  tool_call      // Prisma enum 不支持 hyphen
  tool_result
  ui_block
}

enum SourceType {
  pdf
  markdown
  url
}
```

### 3. Zod Schema 同步

```typescript
// packages/shared/src/schemas/session.ts
export const SessionStatusEnum = z.enum(['active', 'completed', 'archived']);
export const TeachingModeEnum = z.enum(['warm', 'strict', 'interviewer']);
```

## 实施步骤

### Phase 1：添加索引

1. 在 `schema.prisma` 中添加 5 个 `@@index`
2. 生成迁移文件：`pnpm db:migrate`
3. 验证迁移成功

### Phase 2：Enum 迁移（可与迭代 042 Phase 3 合并）

1. 在 `schema.prisma` 中定义 6 个 Enum 类型
2. 修改各 Model 的字段类型
3. 生成迁移文件
4. 更新 Zod Schema 使用 `z.enum()`
5. 更新 TypeScript 代码中的字符串字面量为 Enum
6. 更新 `docs/设计/技术架构.md` 数据模型章节

### Phase 3：验证

1. `pnpm db:migrate` 成功
2. `pnpm build` 通过
3. 全量 E2E 回归通过
4. `docs/设计/技术架构.md` Prisma 代码块与实际 schema 一致

## 验收标准

- [ ] 5 个新索引已添加到 `schema.prisma`
- [ ] 至少 `SessionStatus`、`TeachingMode`、`NodeStatus` 三个 Enum 已迁移
- [ ] Zod Schema 使用 `z.enum()` 替代 `z.string()`
- [ ] `pnpm db:migrate` 成功，无数据损失
- [ ] `pnpm build` 和 E2E 全量回归通过
- [ ] `docs/设计/技术架构.md` 数据模型章节已同步

## 风险

- Enum 迁移涉及数据库 migration，需在生产数据上验证
- Prisma Enum 命名不支持 hyphen（`not-started` → `not_started`），需检查所有引用点
- 迁移文件可能较大，建议 Phase 1（索引）和 Phase 2（Enum）分开提交

## E2E 影响

全量回归（数据库 schema 变更）
