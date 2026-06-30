# Bug 修复：result 接口崩溃 + 路线图未渲染 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复两个产品体验 Bug：① `GET /interview/result` 报 `Cannot read properties of undefined (reading 'findFirst')`；② 诊断完成后提示"路线图已生成"但实际未渲染。

**Architecture:** Bug#7 三重防御——启动脚本前置 `db:generate`、InterviewService 运行时防御 delegate undefined、server/worker 启动校验。Bug#6 校验 `generateRoadmap` 工具返回 `success` + `nodes` 非空才置 `roadmapGenerated` 标志，失败时显示错误而非"已生成"。

**Tech Stack:** Hono + Prisma + Vitest（单元测试）+ Playwright（E2E）

**Spec:** `docs/superpowers/specs/2026-06-30-agent-loop体验与健壮性-design.md` 第 1 组

---

## File Structure

| 文件                                                     | 职责            | 改动                                                  |
| -------------------------------------------------------- | --------------- | ----------------------------------------------------- |
| `packages/shared/src/services/interview-service.ts`      | 面试数据服务    | 4 处方法加 delegate undefined 防御（Bug#7）           |
| `packages/shared/src/services/interview-service.test.ts` | 面试服务单测    | 加 delegate undefined 返回 null 的测试                |
| `apps/server/src/index.ts`                               | server 启动入口 | 启动校验 prisma.interviewResult                       |
| `apps/worker/src/index.ts`                               | worker 启动入口 | 启动校验 prisma.interviewResult                       |
| `apps/web/src/pages/learn.tsx`                           | /learn 壳组件   | handleDiagnosticSubmit 校验 success 才置标志（Bug#6） |
| `e2e/interview.spec.ts`                                  | 面试模式 E2E    | 加 result 接口不崩断言                                |
| `e2e/diagnostic.spec.ts`                                 | 诊断 E2E        | 加路线图失败显示错误的断言                            |

---

## Task 1: InterviewService — delegate undefined 运行时防御（Bug#7 主体）

`prisma.interviewResult` 在 client 未重新生成时为 undefined，调 `.findFirst()` 即崩。给 4 处方法加防御。

**Files:**

- Modify: `packages/shared/src/services/interview-service.ts:50-128`
- Test: `packages/shared/src/services/interview-service.test.ts`

- [ ] **Step 1: 写失败测试 — getResult 在 delegate undefined 时返回 null**

在 `packages/shared/src/services/interview-service.test.ts` 末尾的 `describe("getResult"...)` 块内追加测试。先看现有 mock 结构（`:9-13`）：mock 把 `prisma.interviewResult` 设为 `{ findFirst, create, update }`。要测 delegate undefined，需单独的 describe 块用不同的 mock。

在文件末尾追加：

```ts
describe("InterviewService — delegate undefined 防御", () => {
  it("prisma.interviewResult 为 undefined 时 getResult 返回 null 不抛错", async () => {
    // 临时覆盖 mock，让 interviewResult 为 undefined
    vi.mocked((await import("@ai-teacher/db")).prisma.interviewResult, true);
    // 用 doMock 重新设置 prisma 为不含 interviewResult 的对象
    vi.doMock("@ai-teacher/db", () => ({ prisma: {} }));
    // 重新 import 拿到新 mock 下的 service
    vi.resetModules();
    const { InterviewService: Svc } = await import("./interview-service");
    const r = await Svc.getResult("s1");
    expect(r).toBeNull();
    vi.doUnmock("@ai-teacher/db");
    vi.resetModules();
  });
});
```

> 说明：现有测试在文件顶部 `vi.mock("@ai-teacher/db", ...)` 固定了 mock。delegate undefined 测试需要 `prisma` 对象完全不含 `interviewResult`。更稳妥的做法是用 `vi.hoisted` 暴露一个可变的 interviewResult 对象，见 Step 3 的实现侧改造后改写本测试。先写这个测试表达意图，实现后再调整 mock 方式。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @ai-teacher/shared test -- interview-service.test.ts`
Expected: FAIL（当前 getResult 直接调 `prisma.interviewResult.findFirst`，delegate undefined 会抛 `Cannot read properties of undefined`）

- [ ] **Step 3: 重构 mock 支持可变 interviewResult + 实现 delegate 防御**

先改造测试文件顶部 mock，让 `interviewResult` 可被单个测试置空。将 `packages/shared/src/services/interview-service.test.ts:3-13` 的：

```ts
const { mockFindFirst, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@ai-teacher/db", () => ({
  prisma: {
    interviewResult: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));
```

改为（用可变 holder，允许测试把 interviewResult 设为 undefined）：

```ts
const { mockFindFirst, mockCreate, mockUpdate, interviewResultHolder } =
  vi.hoisted(() => ({
    mockFindFirst: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    interviewResultHolder: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  }));

vi.mock("@ai-teacher/db", () => ({
  prisma: {
    get interviewResult() {
      return interviewResultHolder.value ?? interviewResultHolder;
    },
  },
}));

// 给 holder 加 value 字段用于切空
(interviewResultHolder as { value?: unknown }).value = interviewResultHolder;
```

然后重写 Step 1 的测试为更清晰的形式（替换 Step 1 写入的内容）：

```ts
describe("InterviewService — delegate undefined 防御", () => {
  afterEach(() => {
    // 恢复 interviewResult
    (interviewResultHolder as { value?: unknown }).value =
      interviewResultHolder;
  });

  it("prisma.interviewResult 为 undefined 时 getResult 返回 null 不抛错", async () => {
    (interviewResultHolder as { value?: unknown }).value = undefined;
    await expect(InterviewService.getResult("s1")).resolves.toBeNull();
  });

  it("prisma.interviewResult 为 undefined 时 startOrGet 返回 null 不抛错", async () => {
    (interviewResultHolder as { value?: unknown }).value = undefined;
    await expect(InterviewService.startOrGet("s1")).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: 实现 delegate 防御 — 改 interview-service.ts**

在 `packages/shared/src/services/interview-service.ts` 的 `InterviewService` 对象内，给 4 处方法加防御。

把 `startOrGet`（`:52-61`）改为：

```ts
  /** 取/建 in_progress 面试记录（设定阶段，幂等）。chat-turn 每轮调用注入 prompt */
  async startOrGet(sessionId: string, difficulty: Difficulty = "medium") {
    if (!prisma.interviewResult) {
      console.error("[interview] prisma.interviewResult 未就绪，请运行 pnpm db:generate");
      return null;
    }
    const existing = await prisma.interviewResult.findFirst({
      where: { sessionId, status: "in_progress" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    return prisma.interviewResult.create({
      data: { sessionId, status: "in_progress", difficulty, streak: 0, totalScore: 0 },
    });
  },
```

把 `scoreAnswer`（`:64`，方法体首行 `const interview = await prisma.interviewResult.findFirst` 之前）加：

```ts
  async scoreAnswer(sessionId: string, input: ScoreAnswerInput): Promise<ScoreAnswerResult> {
    if (!prisma.interviewResult) {
      throw new Error("面试服务未就绪（InterviewResult model 未生成），请运行 pnpm db:generate");
    }
    const interview = await prisma.interviewResult.findFirst({
```

把 `finalize`（`:92`，同理）加：

```ts
  async finalize(sessionId: string, input: FinalizeInput): Promise<FinalizeResult> {
    if (!prisma.interviewResult) {
      throw new Error("面试服务未就绪（InterviewResult model 未生成），请运行 pnpm db:generate");
    }
    const interview = await prisma.interviewResult.findFirst({
```

把 `getResult`（`:121`）改为：

```ts
  /** 查询最新面试结果（评分卡/复盘，③ UI 用） */
  async getResult(sessionId: string) {
    if (!prisma.interviewResult) {
      console.error("[interview] prisma.interviewResult 未就绪，请运行 pnpm db:generate");
      return null;
    }
    const interview = await prisma.interviewResult.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    return interview ?? null;
  },
```

> 设计：`getResult`/`startOrGet` 是查询型，delegate 缺失返回 null（UI 显示"暂无结果"）；`scoreAnswer`/`finalize` 是写入型，delegate 缺失抛带提示的错误（让 chat-turn 的 error 流程给用户友好文案）。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @ai-teacher/shared test -- interview-service.test.ts`
Expected: PASS（含新增的 2 个 delegate undefined 测试 + 原有全部测试）

- [ ] **Step 6: typecheck**

Run: `pnpm --filter @ai-teacher/shared typecheck`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/services/interview-service.ts packages/shared/src/services/interview-service.test.ts
git commit -m "fix(interview): InterviewService 防御 prisma.interviewResult undefined 崩溃"
```

---

## Task 2: 启动校验 — server/worker 启动时校验 delegate（Bug#7 第二重防御）

dev/start 脚本前置 generate 是源头修复，但热重载场景仍可能命中旧单例。加启动校验 fail-fast 给明确提示。

**Files:**

- Modify: `apps/server/src/index.ts`
- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: 读取 server 启动入口结构**

Run: `pnpm --filter @ai-teacher/server exec -- cat src/index.ts`（或用 Read 工具读 `apps/server/src/index.ts`），找到 app.listen 之前的位置，确认 prisma 已 import。

- [ ] **Step 2: server 启动校验**

在 `apps/server/src/index.ts` 的 `app.listen(...)` 之前（或 app 初始化之后、listen 之前）加校验。读取文件确认 prisma 的 import 路径后，插入：

```ts
// 启动校验：InterviewResult 等 model delegate 就绪，缺失提示 db:generate
if (!(prisma as unknown as Record<string, unknown>).interviewResult) {
  console.error(
    "[startup] prisma.interviewResult 未就绪。请运行 `pnpm db:generate` 后重启。",
  );
  process.exit(1);
}
```

> 若 server 已 import prisma 则直接用；若未 import，从 `@ai-teacher/db` import `prisma`。

- [ ] **Step 3: worker 启动校验**

同样在 `apps/worker/src/index.ts` 的 worker 启动前（`new Worker(...)` 之前或 worker.run() 之前）加相同校验：

```ts
import { prisma } from "@ai-teacher/db";
// ...
if (!(prisma as unknown as Record<string, unknown>).interviewResult) {
  console.error(
    "[startup] prisma.interviewResult 未就绪。请运行 `pnpm db:generate` 后重启。",
  );
  process.exit(1);
}
```

- [ ] **Step 4: typecheck**

Run: `pnpm -r typecheck`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/index.ts apps/worker/src/index.ts
git commit -m "fix(startup): server/worker 启动校验 prisma delegate 就绪，缺失 fail-fast"
```

---

## Task 3: dev/start 脚本前置 db:generate（Bug#7 源头修复）

`dev`/`start` 脚本不含 `db:generate`，热重载后旧 client 不自愈。前置 generate 保证 client 最新。

**Files:**

- Modify: `package.json:25,27`

- [ ] **Step 1: 修改 dev 脚本**

读取 `package.json:25`，当前：

```json
    "dev": "node scripts/kill-ports.mjs && run-p dev:*",
```

改为（前置 db:generate，用 run-s 串行先 generate 再并行起服务）：

```json
    "dev": "node scripts/kill-ports.mjs && pnpm db:generate && run-p dev:*",
```

- [ ] **Step 2: 修改 fresh 脚本（同样前置）**

读取 `package.json:26`，当前：

```json
    "fresh": "rm -rf apps/web/dist && node scripts/kill-ports.mjs && run-p dev:*",
```

改为：

```json
    "fresh": "rm -rf apps/web/dist && node scripts/kill-ports.mjs && pnpm db:generate && run-p dev:*",
```

- [ ] **Step 3: 验证 db:generate 可正常执行**

Run: `pnpm db:generate`
Expected: 成功生成 Prisma client（输出 `Generated Prisma Client`）

- [ ] **Step 4: 提交**

```bash
git add package.json
git commit -m "fix(scripts): dev/fresh 脚本前置 db:generate 防热重载旧 client"
```

---

## Task 4: 诊断路线图未渲染 — 校验 success 才置标志（Bug#6 主体）

`learn.tsx:1036` 无条件置 `roadmapGenerated=true`，工具失败时仍显示"已生成"但 nodes 空不渲染。改为校验 `success` + `nodes` 非空。

**Files:**

- Modify: `apps/web/src/pages/learn.tsx:1026-1106`
- Test: `e2e/diagnostic.spec.ts`

- [ ] **Step 1: 扩展 tool-result data 类型，补 success 字段**

读取 `apps/web/src/pages/learn.tsx:1027-1034`，当前 `data.result` 类型只有 `firstNode/roadmapUpdate/sessionUpdate`，缺 `success`。改为：

```ts
const data = event.data as {
  toolName?: string;
  result?: {
    success?: boolean;
    error?: string;
    firstNode?: { title?: string };
    roadmapUpdate?: { nodes?: NodeInfo[] };
    sessionUpdate?: { masteredNodes?: number; totalNodes?: number };
  };
};
```

- [ ] **Step 2: 校验 success + nodes 非空才置标志，失败设错误**

读取 `apps/web/src/pages/learn.tsx:1035-1058`，当前 `if (data.toolName === "generateRoadmap")` 块无条件置 `roadmapGenerated = true`。改为：

```ts
if (data.toolName === "generateRoadmap") {
  const result = data.result;
  // 工具失败（如 session.roadmap 不存在）：显示错误而非"已生成"
  if (result && result.success === false) {
    setDiagnosticError(result.error ?? "路线图生成失败，请重试");
    setDiagnosticAnalyzing(false);
    setDiagnosticSubmitted(true);
    return;
  }
  // 成功且有 nodes 才置标志
  if (
    result?.success !== false &&
    Array.isArray(result?.roadmapUpdate?.nodes) &&
    result.roadmapUpdate.nodes.length > 0
  ) {
    roadmapGenerated = true;
    setNodes(result.roadmapUpdate.nodes);
    firstNodeTitle = result.firstNode?.title ?? firstNodeTitle;
    if (result.sessionUpdate?.totalNodes !== undefined) {
      const sessionUpdate = result.sessionUpdate;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                progress: {
                  ...s.progress,
                  totalNodes: sessionUpdate.totalNodes!,
                  masteredNodes: sessionUpdate.masteredNodes ?? 0,
                },
              }
            : s,
        ),
      );
    }
  }
}
```

- [ ] **Step 3: roadmap-updated 事件加 nodes 非空守卫**

读取 `apps/web/src/pages/learn.tsx:1061-1069`，当前：

```tsx
if (event.type === "roadmap-updated" && event.data) {
  roadmapGenerated = true;
  const data = event.data as { nodes: NodeInfo[] };
  setNodes(data.nodes);
  firstNodeTitle =
    data.nodes.find((node) => node.status === "in_progress")?.title ??
    data.nodes[0]?.title ??
    firstNodeTitle;
}
```

改为（加 nodes 非空守卫）：

```tsx
if (event.type === "roadmap-updated" && event.data) {
  const data = event.data as { nodes: NodeInfo[] };
  if (data.nodes && data.nodes.length > 0) {
    roadmapGenerated = true;
    setNodes(data.nodes);
    firstNodeTitle =
      data.nodes.find((node) => node.status === "in_progress")?.title ??
      data.nodes[0]?.title ??
      firstNodeTitle;
  }
}
```

- [ ] **Step 4: 加 diagnosticError state 声明**

在 `learn.tsx` 顶部组件 state 区域（与 `setChatError`/`setDiagnosticAnalyzing` 同区，搜索 `const [diagnosticAnalyzing` 定位），加：

```ts
const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
```

并在 catch 块（`:1107-1114`）和 `handleDiagnosticSubmit` 开头（`:963` 附近）也清空 diagnosticError：

```ts
// 开头（setDiagnosticSubmitted(true) 之前/之后）
setDiagnosticError(null);
```

catch 块末尾加 `setFirstLessonPreparing(false)` 已有（`:1110`），保持。

- [ ] **Step 5: UI 展示 diagnosticError**

在诊断分析区域（搜索 `setDiagnosticAnalyzing` 或 `firstLessonPreparing` 相关的 UI 渲染，约 `:1150-1160`），加错误展示。读取该区域确认结构后，在 loading 文案旁加：

```tsx
{
  diagnosticError && (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {diagnosticError}
    </div>
  );
}
```

> 若该区域已有 `chatError` 的展示样式，复用同款样式。`diagnosticError` 在 5s 后自动清除可复用 `chatError` 的 setTimeout 模式，或保留直到下次操作。

- [ ] **Step 6: fetchSession 兜底加延迟重试**

读取 `apps/web/src/pages/learn.tsx:1116-1126`，当前 `fetchSession(sessionId).then(...)` 直接 `setNodes(data.session.roadmap?.nodes ?? [])`。改为：若 nodes 为空，短延迟后重 fetch 一次（应对 DB 写入时序）：

```ts
fetchSession(sessionId)
  .then((data) => {
    if (data) {
      const fetchedNodes = data.session.roadmap?.nodes ?? [];
      if (fetchedNodes.length > 0) {
        setNodes(fetchedNodes);
      } else if (roadmapGenerated) {
        // 路线图已生成但首次 fetch 为空（DB 写入时序），延迟重试一次
        setTimeout(() => {
          fetchSession(sessionId)
            .then((d) => {
              if (d?.session.roadmap?.nodes?.length)
                setNodes(d.session.roadmap.nodes);
            })
            .catch(console.error);
        }, 500);
      }
    }
    return fetchSessions(USER_ID);
  })
  .then((data) => {
    if (data) setSessions(data.sessions);
  })
  .catch(console.error);
```

- [ ] **Step 7: typecheck + build**

Run: `pnpm --filter @ai-teacher/web typecheck && pnpm --filter @ai-teacher/web build`
Expected: PASS

- [ ] **Step 8: E2E — 加路线图失败显示错误的断言**

读取 `e2e/diagnostic.spec.ts`，在诊断流程测试中加一个用例：mock generateRoadmap 返回 `{success:false}` 时，断言显示错误而非"路线已生成"。

> 注意：E2E 用真实 LLM 难以稳定制造工具失败。可改为：在诊断提交后，断言"路线已生成"文案只在路线图实际渲染（右侧栏可见）时出现。若项目 E2E 用 mock provider，则在 mock 里让 generateRoadmap 返回 success:false。读取 `e2e/diagnostic.spec.ts` 和 mock 设置（搜索 `MOCK_LLM` 或 e2e setup）确认可注入点后编写。

最低限度断言（若无法 mock 工具失败）：

```ts
test("诊断成功后路线图可见且'路线已生成'文案与渲染一致", async ({ page }) => {
  // ... 走完诊断流程 ...
  // 断言：若显示"路线已生成"，则右侧栏路线图节点可见
  const preparingText = page.locator("text=路线已生成");
  if (await preparingText.isVisible()) {
    await expect(
      page.locator("[data-testid='roadmap-node'], .react-flow__node").first(),
    ).toBeVisible();
  }
});
```

- [ ] **Step 9: 运行相关 E2E**

Run: `pnpm test:e2e e2e/diagnostic.spec.ts e2e/learn.spec.ts`
Expected: PASS（含新增断言）

- [ ] **Step 10: 提交**

```bash
git add apps/web/src/pages/learn.tsx e2e/diagnostic.spec.ts
git commit -m "fix(diagnostic): 校验 generateRoadmap success 才置标志，失败显示错误而非'已生成'"
```

---

## Task 5: 面试模式 E2E — result 接口不崩断言（Bug#7 验证）

**Files:**

- Test: `e2e/interview.spec.ts`

- [ ] **Step 1: 加 result 接口不崩断言**

读取 `e2e/interview.spec.ts`，在面试结果查询相关测试中加断言：`GET /api/sessions/:id/interview/result` 返回 200 且 `{ result }` 结构（即使 null 也是 200，不 500）。

```ts
test("面试结果接口返回 200 不崩溃", async ({ request, page }) => {
  // 前置：进入一个面试会话（复用现有 setup）
  const sessionId = /* 从现有测试 setup 获取 */;
  const res = await request.get(`/api/sessions/${sessionId}/interview/result`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("result");
});
```

> 若现有 interview.spec.ts 已有进入会话的 setup helper，复用之。`result` 为 null（未完成面试）也是合法的 200。

- [ ] **Step 2: 运行面试 E2E**

Run: `pnpm test:e2e e2e/interview.spec.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add e2e/interview.spec.ts
git commit -m "test(interview): 加 result 接口 200 不崩溃断言"
```

---

## Task 6: 收尾 — 全量质量门控 + 文档同步

- [ ] **Step 1: 全量单测**

Run: `pnpm test:unit`
Expected: PASS（原有 + 新增测试）

- [ ] **Step 2: lint + check:deps + check:docs**

Run: `pnpm lint && pnpm check:deps && pnpm check:docs`
Expected: PASS（若 check:docs 因 API/schema 变化失败，按提示更新 `docs/设计/API接口.md`）

- [ ] **Step 3: web build**

Run: `pnpm --filter @ai-teacher/web build`
Expected: PASS

- [ ] **Step 4: 文档同步**

按 `文档同步规则.md` 触发映射表评估：

- Bug#7 涉及面试 API 行为（getResult 返回 null 而非崩溃）→ 检查 `docs/设计/API接口.md` 面试 result 接口描述是否需补注"delegate 未就绪返回 null"
- Bug#6 是前端逻辑修复，无 API/schema 变化，无需文档同步
- 若有变更，更新对应文档

- [ ] **Step 5: 更新开发日志**

更新 `docs/开发/开发日志.md` 的"下次继续"区域（覆盖写，2-5 行）：

```markdown
- **当前进度**：修复两个 Bug — result 接口 delegate undefined 崩溃（三重防御）+ 诊断路线图未渲染（校验 success 才置标志）。
- **验证**：单测 + E2E（diagnostic/learn/interview）全绿。
- **下一步**：进入第 2 组 Agent Loop 健壮性迭代（failover + 循环检测 + 模型切换 abort 通道）。
```

- [ ] **Step 6: 提交文档**

```bash
git add docs/开发/开发日志.md docs/设计/API接口.md
git commit -m "docs: 同步 Bug 修复开发日志 + API 文档"
```
