# 迭代 047：Redis/MinIO 功能闭环（从预留到实际使用）

> 优先级：P2 | 分类：优化 | 状态：✅ 已完成（2026-06-26，仅 Phase 1 评估+文档修正）
> E2E：视具体功能新增测试

> **📝 修订记录（2026-06-26，执行前核查实际代码）**：
> 原方案对 Redis 角色的描述错误。实际 Redis = **BullMQ 队列 + Pub/Sub 流式推送骨干**（worker `run-agent-loop.ts` publish 流式 token → Redis channel `chat:${sessionId}` → server `chat.ts` subscriber → SSE 推前端），非"会话状态/对话缓存预留"。技术架构.md 第 21/566 行"缓存/预留"表述与第 704 行"BullMQ + Redis Pub/Sub"自相矛盾，本次修正。
> Phase 2（MinIO 存储服务）暂缓——迭代 009（P3、1.2.0、待开始）不在近期，实施会产生半成品代码。Phase 3（Redis 缓存）不实施——本地单用户场景 ROI 为负。详见 ADR-026。

## 不足点

Docker Compose 启动了 PostgreSQL、Redis、MinIO 三个中间件，但实际使用情况：

| 中间件     | 启动状态  | 实际用途              | 闲置情况                                                                   |
| ---------- | --------- | --------------------- | -------------------------------------------------------------------------- |
| PostgreSQL | ✅ 必需   | 主数据库，全量使用    | 无                                                                         |
| Redis      | ✅ 已启动 | BullMQ 队列依赖 Redis | BullMQ 内部使用，但会话状态和对话缓存未使用                                |
| MinIO      | ✅ 已启动 | 文件存储              | **完全未使用**——Source model 有 `fileUrl` 字段，但上传→存储→检索链路未实现 |

**具体问题：**

- Redis：`技术架构.md` 标注"会话状态 + 对话缓存（预留）"，但会话状态直接查 DB，对话历史直接从 Message 表加载
- MinIO：`docker-compose.yml` 配置了 MinIO API（29000）+ Console（29001），但 `apps/server/src/` 没有任何 S3/MinIO 客户端代码
- Source model 的 `fileUrl` 和 `checksum` 字段定义了但从未写入
- 迭代 009（学习资料上传 + RAG）是 1.0.0 的待开始迭代，它依赖 MinIO 存储和 Redis 缓存

**参考资料来源：**

- Redis 会话缓存最佳实践：Redis 作为 Session Store + Hot Data Cache
- MinIO + S3 客户端：`@aws-sdk/client-s3` 用于 Node.js S3 兼容存储
- pgvector：PostgreSQL 的向量检索扩展，已在 Docker 中安装但未创建向量索引

## 目标

1. 实现 Redis 会话缓存层（热数据缓存，减少 DB 查询）
2. 实现 MinIO 文件存储服务（为迭代 009 RAG 铺路）
3. 评估是否可以降低中间件资源占用（如 Redis 缓存价值不大则移除依赖）

## 可优化方向

### 1. Redis 会话缓存（评估后决定是否实施）

**可能收益：**

- 热门会话的最近 N 条消息缓存到 Redis，减少 DB 查询
- 会话状态（active/completed）缓存，列表查询走 Redis

**可能不值得：**

- 当前单用户本地使用场景，DB 查询压力极低
- 引入缓存层增加了一致性复杂度（DB ↔ Redis 双写）
- BullMQ 已依赖 Redis，但那是为了队列可靠性，不是为了性能

**建议：** 评估后如果当前场景不需要 Redis 缓存，就在 `技术架构.md` 中明确标注"BullMQ 队列依赖，缓存功能暂不启用"，而不是模糊的"预留"。

### 2. MinIO 文件存储服务

**为迭代 009 铺路：**

```
用户上传 PDF/Markdown/URL
  → apps/server API 接收文件
  → MinIO 存储原始文件（Source.fileUrl = minio://bucket/sources/{id}/xxx.pdf）
  → 计算文件 checksum（Source.checksum = sha256）
  → 异步：解析文件内容 → 分块 → pgvector 向量化
```

**实现步骤：**

1. 安装 `@aws-sdk/client-s3`
2. 创建 `apps/server/src/services/storage.ts`（MinIO S3 客户端封装）
3. 创建 `apps/server/src/routes/upload.ts`（文件上传 API）
4. 在 `docker-compose.yml` 中配置 MinIO 默认 bucket

### 3. 中间件资源优化

如果评估后 Redis 缓存暂不需要，考虑：

- 将 Redis 从 Docker Compose 中保留（BullMQ 依赖），但在文档中明确其角色
- MinIO 如果迭代 009 不在近期启动，考虑是否需要在 bootstrap 时就启动

## 实施步骤

### Phase 1：评估与文档修正

1. 评估 Redis 缓存在当前场景下的 ROI
2. 更新 `技术架构.md` 中间件章节，明确各中间件的实际角色（去掉"预留"模糊表述）
3. 更新 `决策记录.md`，记录评估结论

### Phase 2：MinIO 存储服务（如迭代 009 在近期启动）

1. 安装 `@aws-sdk/client-s3`
2. 创建 `apps/server/src/services/storage.ts`
3. 创建 `apps/server/src/routes/upload.ts`
4. 更新 `docs/设计/API接口.md`
5. 更新 `docs/设计/技术架构.md` 环境变量章节

### Phase 3：Redis 缓存（如评估结论为需要）

1. 在 `apps/server/src/services/` 下创建 Redis 缓存服务
2. 热数据（最近会话列表、最近 N 条消息）写入 Redis
3. 读取优先走 Redis，miss 时回退到 DB
4. 更新 `技术架构.md` 中间件章节

## 验收标准

- [x] `技术架构.md` 中间件章节已更新，无"预留"模糊表述（修正 4 处：技术栈表 DB/队列/存储三行、端口表 Redis/MinIO、Docker Compose 章节注释、环境变量 MINIO\_\* 注释）
- [ ] 如实施 MinIO 存储服务：文件上传→存储→检索链路可用（**Phase 2 暂缓**，迭代 009 不在近期，见 ADR-026）
- [ ] 如实施 Redis 缓存：热数据缓存命中率可观测（**Phase 3 不实施**，本地单用户 ROI 为负，见 ADR-026）
- [x] `决策记录.md` 记录了中间件角色评估结论（ADR-026）
- [x] Docker Compose 中所有中间件都有明确的使用理由（postgres 主库 + pgvector 为 009 准备 / redis 队列+Pub/Sub / minio 为 009 准备 / opensandbox 沙箱）

## 完成记录（2026-06-26）

- **Phase 1（评估+文档修正）**：核查发现 Redis 实际角色是 BullMQ 队列 + Pub/Sub 流式推送骨干（非文档所述"会话状态/对话缓存预留"）。修正技术架构.md 4 处自相矛盾/过时表述。MinIO/pgvector 保留在 docker-compose（为 009 准备，本地全启无额外成本），文档明确角色而非模糊"预留"。
- **Phase 2（MinIO 存储服务）暂缓**：迭代 009（P3、1.2.0、待开始）不在近期，实施会产生半成品代码。等 009 启动时与 RAG 链路一并实施。
- **Phase 3（Redis 缓存）不实施**：本地单用户场景 DB 压力极低 + 双写一致性复杂度，ROI 为负。Redis 角色明确为队列+Pub/Sub，无缓存层。
- **验证**：check:docs 通过（文档修正未破坏 .env.example ↔ 技术架构环境变量 KEY 一致性）。无代码变更，无需 typecheck/test/E2E。

## 风险

- MinIO 存储服务如果实现但迭代 009（RAG）迟迟不启动，可能产生"半成品"代码
- Redis 缓存引入双写一致性问题，需要仔细设计 cache invalidation 策略
- `@aws-sdk/client-s3` 包体积较大（~3MB），对 monorepo 影响可控但需评估

## E2E 影响

如实施 MinIO 上传功能：新增上传相关 E2E 测试（分类 K）
如仅文档修正：无 E2E 影响
