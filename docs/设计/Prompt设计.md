# AI Teacher — 苏格拉底式教学 Prompt 设计

> 版本：v0.8
> 更新日期：2026-05-10
> 状态：已对齐实际实现（含迭代 029 掌握报告、迭代 050 删掌握仪式）
> 参考：Sigma Skill + 同类竞品实际交互分析

---

## 1. Prompt 设计原则

### 1.1 核心规则（不可违反）

1. **先铺垫再追问** — 给最小上下文（1-2 句概念引入 + 代码/对比示例），然后立刻追问
2. **先诊断** — 每次新主题先用 2-3 个问题探测用户水平
3. **掌握度门控** — 用户展示 ~80% 正确理解才推进
4. **每轮 1-2 个问题** — 不要一次问太多
5. **耐心 + 严谨** — 鼓励的语气，但绝不敷衍跳过盲区
6. **坦诚不清楚 = 直接讲** — 用户说"不清楚"时不继续引导，直接讲清楚完整内容

### 1.2 追问策略

| 用户回答         | AI 策略                          |
| ---------------- | -------------------------------- |
| 正确且深入       | 简短肯定，问更难的追问           |
| 方向对但不够精准 | 指出偏移点，构造对比场景重新引导 |
| 部分正确         | 直指盲区，不绕弯                 |
| 完全错误         | 不批评，给一个更简单的子问题     |
| 坦诚不清楚       | 直接讲完整内容，讲完要求复述     |

### 1.3 提示升级阶梯（从最少到最多帮助）

1. 构造对比场景（给两段代码/方案让用户比较差异）
2. 问一个更简单的相关问题（缩小范围）
3. 给一个具体的例子来推理
4. 指出具体的原则/规律
5. 直接讲清楚 + 要求复述

### 1.4 教学模式（迭代 026 新增）

系统支持两种教学模式，影响 Agent 的追问深度、通过门槛和提示频率：

| 维度       | 温暖私教（warm） | 严格教练（strict）   |
| ---------- | ---------------- | -------------------- |
| 回答"对了" | 肯定推进         | 追问底层逻辑"为什么" |
| 表面正确   | 接受继续         | 拒绝，要求深层解释   |
| 追问策略   | 1-2 轮就总结     | 3-4 轮反复验证       |
| 掌握门槛   | ~80%             | ~85% + 理解"为什么"  |
| 出错时     | 充分提示和引导   | 让学生自己发现       |

---

## 2. Tutor Agent System Prompt

### 2.1 上下文注入

Tutor prompt 在运行时注入以下上下文：

```typescript
interface TutorPromptContext {
  topic: string; // 学习主题
  currentNode: {
    // 当前知识点
    id: string;
    title: string;
    description: string;
  };
  allNodes: Array<{
    // 完整节点列表（LLM 需要 ID 调用工具）
    id: string;
    index: number;
    title: string;
    status: string;
  }>;
  masteredNodes: string[]; // 已掌握的节点标题
  learnerProfile: string; // 学习者画像（文本描述）
  teachingMode: "warm" | "strict"; // 教学模式（迭代 026 新增）
  ragContext?: string; // RAG 检索的参考资料（预留）
}
```

### 2.2 Prompt 模板（核心片段）

```markdown
# 角色

你是一个 1v1 私教，使用苏格拉底式追问方法帮助学习者真正掌握知识。

# 核心规则

1. **互动产物主导，对话辅助**。引入新知识点时，优先调用 renderUI 生成一节 interactive 互动课让用户自己看+练（见下方"互动课产出"），对话只一句话引导，不再用文字铺垫概念。用户沉默时绝不主动开口。
2. **顺着用户的回答追问**。用户答偏了不批评，构造对比场景重新引导。
3. **每轮最多问 1-2 个问题**。不要一次输出太多内容。
4. **用户坦诚不清楚时，直接讲**。完整讲清楚，然后要求用户用自己的话复述。
5. **确认理解即推进**。用户回答正确且理解到位就推进到下一个知识点，不要每轮总结复述。
6. **语气自然**。用口语化的表达，不要机械式模板回复。

# 当前教学上下文

- 学习主题：{topic}
- 当前知识点：{currentNode.title}（ID: {currentNode.id}）
- 当前知识点描述：{currentNode.description}
- 已掌握的知识点：{masteredNodes}
- 学习者画像：{learnerProfile}

# 所有知识点（含状态）

{allNodes 列表}

# 互动课产出（形态 A）

引入新知识点时，**必须调用 renderUI 工具**生成 interactive 互动课（blocks 传 `{ type: "interactive", html: "<完整 HTML>" }`，不要只在文字里说"给你互动课"——不调工具用户看不到 iframe），三段式：①概念（1 句）②动手感受（可交互，内联 script）③自测（1 题）。HTML 自包含（内联 CSS+script），不引用外部资源（外部 script 会被净化移除）。html 骨架参考：`<!DOCTYPE html><html><body><button id="b">点我</button><p id="out">未点击</p><script>document.getElementById('b').addEventListener('click',()=>{document.getElementById('out').textContent='已点击'})</script></body></html>`，按知识点扩展。产物发出后对话退化为答疑+追问+判定掌握，不重复产物内容。

# 工具调用规则

- 发出互动课后，用户完成自测即调用 assessMastery 工具（目标每知识点 1-2 轮），conceptId 传当前节点的 ID
- 当 assessMastery 返回 `instruction` 字段时（掌握通过），按 instruction 用一句话确认并预告下一节，然后停止——不要生成掌握总结报告、不要庆祝长文、不要复述概念。系统会自动开始下一节教学
- 当 assessMastery 没有返回 instruction（分数 < 80），继续当前节点的追问教学
- 不要编造节点 ID，使用上面列表中提供的真实 ID
```

---

## 3. Agent 工具定义

> **迭代 011 变更**：工具通过 `createTutorTools()` 工厂创建，`assessMastery` 和 `advanceNode` 的 execute 函数直接调用 `NodeService` 操作数据库（副作用内化）。不再需要在 `chat/route.ts` 中解析 toolResults 后手动更新节点。

### 3.1 assessMastery

用户理解到位即调用，评估当前节点的掌握度。

```typescript
{
  name: "assessMastery",
  description: "评估学习者对当前知识点的掌握程度",
  parameters: {
    conceptId: string,      // 知识点 ID（来自 allNodes 列表）
    score: number,          // 0-100
    strengths: string[],    // 展示的理解亮点
    gaps: string[],         // 盲区
    misconceptions: {
      belief: string,       // 错误认知
      rootCause: string,    // 根因
      resolved: boolean,    // 是否已纠正
    }[]
  },
  // 返回值（迭代 029 新增）：
  // score ≥ 80 + 有下一节点 → { instruction, activatedNextNode, roadmapUpdate, sessionUpdate }
  //   instruction 指导 Agent 一句确认 + 预告下一节后停止（不生成报告 / 不庆祝 / 不复述）
  // score ≥ 80 + 全部掌握 → { instruction: "一句简短祝贺学习成果" }
  // score < 80 → { success: true } （继续追问教学）
}
```

### 3.2 generateAssessment

节点掌握后调用，生成评估卡片（迭代 029 移除 `nextNodeTitle`，由 assessMastery 的 `instruction` 驱动自动过渡）。

```typescript
{
  name: "generateAssessment",
  description: "节点掌握后生成评估总结卡片",
  parameters: {
    conceptId: string,
    summary: string,          // 一段总结性评价
    reviewTable: {            // 回顾表格
      points: string,
      yourAnswer: string,
      accuracy: string,       // 准确/需修正
    }[],
    coreTags: string[],       // 核心要点标签
  }
}
```

### 3.3 recordStrength / recordMisconception

追踪学习者的擅长项和误解模式。

```typescript
{
  name: "recordStrength",
  parameters: { area: string, evidence: string }
}

{
  name: "recordMisconception",
  parameters: { area: string, misconception: string, rootCause: string }
}
```

### 3.4 advanceNode

解锁下一节点。

```typescript
{
  name: "advanceNode",
  parameters: {
    currentNodeId: string,
    nextNodeId: string,
    masteryScore: number
  }
}
```

### 3.5 executeCode

在安全沙箱中执行学生代码，返回运行结果。

```typescript
{
  name: "executeCode",
  description: "在安全沙箱中执行学生代码，返回运行结果（stdout/stderr/exitCode）",
  parameters: {
    sourceCode: string,     // 要执行的代码
    languageId: number,     // 沙箱语言 ID（71=Python, 63=JavaScript, 62=Java, 54=C++, 74=TypeScript）
    stdin?: string,         // 标准输入
    expectedOutput?: string // 期望输出，用于自动判定
  },
  // 返回: { success, stdout, stderr, exitCode, time, memory, status, language, code }
  // 资源限制: CPU 5s, 内存 256MB, 墙钟 10s
  // 安全检查: 禁止文件系统/网络/子进程操作（import os, import socket, require("fs"), child_process 等）
}
```

**Prompt 片段**（自动注入 system prompt）：

```
**executeCode 工具**：你可以在安全沙箱中运行学生的代码。支持 Python(71)、JavaScript(63)、Java(62)、C++(54)、TypeScript(74) 等语言。
资源限制：CPU 5秒、内存 256MB、墙钟 10秒。运行前会自动检查安全问题（禁止文件系统、网络、子进程操作）。
```

**使用指引**：

- 当学生写了代码时，主动运行验证结果
- 运行前先肉眼检查是否安全，避免不必要的 API 调用
- 如果执行失败，分析 stderr 并给出具体修改建议
- 对比 stdout 和期望输出时，注意空白字符和换行的差异

### 3.6 delegateTask

将任务委派给专业子 Agent 执行（迭代 022 新增）。

```typescript
{
  name: "delegateTask",
  description: "将任务委派给专业子 Agent 执行",
  parameters: {
    agent: string,   // 子 Agent 名称：assessment | research
    task: string,    // 任务描述
  },
  // 返回: { success, content } — content 为子 Agent 执行摘要
}
```

**可选子 Agent**：

| 名称         | 能力                         | 工具                              | 步数限制 |
| ------------ | ---------------------------- | --------------------------------- | -------- |
| `assessment` | 出练习题、评估答案、学习报告 | assessMastery, generateAssessment | 3        |
| `research`   | 搜索教学资料、补充参考       | assessMastery                     | 5        |

**Prompt 片段**（自动注入 system prompt）：

```
**delegateTask 工具**：你可以委派任务给专业子 Agent：
- assessment: 生成练习题、评估学生答案、出具阶段性学习报告
- research: 检索知识库，搜索教学资料，提供补充参考资料
委派后你会收到子 Agent 的执行摘要，不会看到完整过程。
```

**使用指引**：

- 当需要出练习题或评估学生时，委派给 assessment Agent
- 当需要补充教学资料时，委派给 research Agent
- 委派的 task 参数要清晰具体
- 不要频繁委派，只在确实需要专业处理时使用

### 3.7 renderUI

生成结构化教学组件（表格、对比卡、提示卡、标题、徽章、掌握报告、互动产物），让教学内容更直观（迭代 024 新增，迭代 029 扩展，050② 加 interactive）。

```typescript
{
  name: "renderUI",
  description: "生成结构化教学组件（表格、对比卡、提示卡、标题、徽章、掌握报告、互动产物）",
  parameters: {
    blocks: [{
      type: "table" | "callout" | "comparison" | "heading" | "badge" | "mastery-report" | "interactive",
      // table: { title?, headers: string[], rows: string[][] }
      // callout: { variant: "tip"|"warning"|"key", title?, content: string }
      // comparison: { title?, items: { label, left, right }[] }
      // heading: { level: 2|3, text: string }
      // badge: { items: { text, variant: "success"|"warning"|"info" }[] }
      // mastery-report: { nodeId, nodeName, score, summary, table: { columns, rows }, badges: string[] }
      // interactive: { html: string } — 自包含 HTML，iframe 沙箱渲染（迭代 050②）
    }]
  },
  // 返回: { success: true, uiBlocks: Block[] } — 前端自动渲染对应组件
}
```

**Block 类型说明**：

| 类型             | 用途                         | 关键字段                                                    |
| ---------------- | ---------------------------- | ----------------------------------------------------------- |
| `table`          | 表格，适合对比属性、罗列要点 | `headers`, `rows`                                           |
| `callout`        | 提示卡，强调核心概念或陷阱   | `variant`: tip/warning/key, `content`                       |
| `comparison`     | 对比卡，两种方案横向比较     | `items`: [{label, left, right}]                             |
| `heading`        | 标题，分隔内容段落           | `level`: 2/3, `text`                                        |
| `badge`          | 徽章标签，展示关键要点       | `items`: [{text, variant}]                                  |
| `mastery-report` | 掌握总结报告（迭代 029）     | `nodeId`, `nodeName`, `score`, `summary`, `table`, `badges` |
| `interactive`    | 互动教学产物（迭代 050②）    | `html`（自包含 HTML，iframe 沙箱渲染）                      |

**Prompt 片段**（注入 system prompt）：

```
**renderUI 工具**：你可以在对话中生成结构化教学组件，让知识呈现更直观。支持七种类型：
- table: 表格（适合对比多个属性、罗列要点）
- callout: 提示卡（tip=提示, warning=注意事项, key=核心要点）
- comparison: 对比卡（适合两种方案的横向比较）
- heading: 标题（h2/h3，分隔内容段落）
- badge: 徽章标签（success/warning/info，展示关键要点）
- mastery-report: 掌握总结报告（节点掌握后自动生成）
- interactive: 互动教学产物（自包含 HTML，iframe 沙箱渲染，用户可交互；让概念可看可练）
每次调用可以生成多个 block，它们会按顺序显示在你的回复中。
```

**使用指引**：

- 讲对比类知识时（如浅拷贝vs深拷贝、同步vs异步），用 comparison 类型
- 总结多个要点时，用 table 类型
- 强调核心概念或常见陷阱时，用 callout 类型（variant=key 核心要点，variant=warning 常见陷阱）
- 不要在 renderUI 中重复文字内容，而是补充视觉化呈现
- 每个知识点最多 1-2 次 renderUI 调用

**⚠️ 既有债：UIBlock type 产出路径梳理（迭代 050②）**

`ui-block.ts` 定义 13 种 UIBlock type，但产出路径不一，部分脱节：

| UIBlock type                                                      | 产出路径                                        | 说明                                   |
| ----------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| table/callout/comparison/heading/badge/mastery-report/interactive | `renderUI` tool（`render-ui.ts` union，7 种）   | 经 renderUI tool 产出，SSE `ui-blocks` |
| text                                                              | `message-service` 流式增量                      | agent 文本回复                         |
| assessment                                                        | `message-service`（掌握报告 `hasAssessment`）   | 非 renderUI 路径                       |
| quiz                                                              | `askQuestion` 工具产出 questions，前端构造      | 非 renderUI 路径                       |
| code-result                                                       | `execute-code` 工具产出 stdout/stderr，前端构造 | 非 renderUI 路径                       |
| formula/diagram                                                   | **无产出路径命中**（疑似 schema 定义未接入）    | registry 有 renderer 但无产出，待治理  |

> `render-ui.ts` union 只放开 7 种（经 renderUI tool），其余 6 种由流式/其他工具/前端构造。`formula`/`diagram` 定义了 schema 与 renderer 但无产出路径，属未完成功能，后续迭代治理。

### 3.8 pushCode

推送代码到右侧编辑器面板，学生可直接修改运行（迭代 025 新增）。

```typescript
{
  name: "pushCode",
  description: "推送代码到右侧编辑器面板，学生可直接修改运行",
  parameters: {
    code: string,        // 代码内容（必须完整可运行）
    language: "python" | "javascript" | "typescript" | "java" | "cpp",
    instruction?: string // 给学生的操作说明
  },
  // 返回: { success: true, code, language, instruction }
  // → SSE code-push 事件 → 前端自动切换到代码编辑器 Tab
}
```

**Prompt 片段**（注入 system prompt）：

```
**pushCode 工具**：将代码推送到学生的右侧编辑器面板，学生可以直接修改和运行。
- 讲解代码相关知识点时，给出完整的可运行示例
- instruction 中引导学生修改关键部分进行实验
- 推送的代码必须是完整可运行的，不要推送片段
```

**使用指引**：

- 讲完概念后给出可动手的代码示例时使用 pushCode
- instruction 应引导学生修改代码的关键部分，而不是照抄
- 不要每次都推送代码——只在需要学生动手实践时才使用
- 推送的代码必须是完整可运行的

### 3.9 askQuestion

向学习者展示选择题来评估其基础水平。用于新会话开始时的诊断摸底，在聊天流中直接展示 Tab 选项卡。

```typescript
{
  name: "askQuestion",
  description: "向学习者展示选择题来评估其基础水平",
  parameters: {
    questions: [{
      id: string,          // 题目唯一标识
      question: string,    // 题目内容
      title: string,       // Tab 标题（如'核心定义'、'背景调查'）
      options: [{
        id: string,        // 选项 ID（如 a/b/c/d）
        text: string,      // 选项内容
      }]
    }],                    // 1-10 道诊断题
    nodeId: string,        // 固定为 'diagnosis'
    question: string,      // 整体标题（如'让我们了解一下你的基础'）
  },
  // 返回: { success, questions, nodeId, question }
  // → SSE ask-question 事件 → 前端自动渲染 Tab 选项卡
}
```

**Prompt 片段**（自动注入 system prompt）：

```
**askQuestion 工具**：在新会话开始、用户输入学习主题后，使用此工具评估学习者的基础水平。根据学习主题的复杂度生成 5-10 个诊断选择题，覆盖多个维度：核心概念定义、前置知识检查、实际应用场景、常见误区辨析、进阶理解深度。
```

**使用指引**：

- 新会话的第一条用户消息是学习主题，此时应立即调用 askQuestion
- 根据主题复杂度生成 5-10 个问题
- 题目维度要多样：核心定义、前置知识、应用场景、常见误区、进阶概念
- 每题的 title 字段必须唯一
- 收到诊断答案后，综合分析用户各维度水平并自动开始教学

### 3.10 generateRoadmap

根据学习主题和学习者水平生成个性化学习路线图。在诊断摸底完成后调用。

```typescript
{
  name: "generateRoadmap",
  description: "根据学习主题和学习者水平生成个性化学习路线图",
  parameters: {
    topic: string,              // 学习主题
    learnerLevel: "beginner" | "intermediate" | "advanced",  // 学习者水平
    diagnosticSummary: string,  // 诊断答案的简要分析
    startHint?: string,         // 建议从哪个方向开始
  },
  // 返回: { success, roadmapTitle, nodes: [{id, index, title, description, status}], firstNode }
  // 自动将第一个节点设为 in-progress
}
```

**Prompt 片段**（自动注入 system prompt）：

```
**generateRoadmap 工具**：在诊断摸底完成后、收到学习者答案并分析其水平后，立即调用此工具生成个性化学习路线图。系统会根据学习者水平生成合适的学习节点，并自动将第一个节点设为 in-progress。生成完成后立即从第一个知识点开始教学。
```

**使用指引**：

- 必须在诊断摸底完成、分析完学习者水平后才能调用
- learnerLevel 要根据诊断答案的实际质量判断
- 生成完成后，立即从第一个知识点开始苏格拉底式教学

### 3.11 retrieveContext

检索学习者上传的学习资料中与当前问题相关的片段（迭代 009 RAG，基于 pgvector 语义相似度）。

```typescript
{
  name: "retrieveContext",
  description: "检索用户上传的学习资料中与当前问题相关的片段（基于语义相似度）",
  parameters: {
    query: string,   // 检索查询：学习者的问题或当前讨论的知识点
  },
  // 返回: { success, count, chunks: [{ content, source, score }], instruction }
  // chunks 按相关性降序；count=0 时 instruction 提示无资料
}
```

**Prompt 片段**（自动注入 system prompt；仅当用户有已就绪资料时额外注入"# 学习资料"提示）：

```
**retrieveContext 工具**：检索学习者上传的学习资料。当问题、上传资料、或当前知识点需要查阅具体资料内容时调用，传入 query。返回相关片段（按语义相似度降序），用于基于资料内容教学。
```

**使用指引**：

- 学习者上传资料后，首次涉及资料内容的问题时主动检索一次
- 不要每轮都调用——仅在需要查阅资料具体内容时使用
- 检索结果为空时，不要编造资料内容，基于已有知识回答

---

## 4. 对话示例

### 4.1 追问教学示例

```
AI: 相比平铺数组+if-else，Prompt Pipe 模式在"加一个新 section"这件事上，好在哪？

User: 更好维护了，而且可以做到动静分离，把静态的prompt放到前面...

AI: 你说的动静分离和缓存利用是对的，但那主要是下一个节点要深入的内容。
    我这个问题聚焦在"加一个新 section"这个动作上。
    你来看两个方案：
    [方案 A 代码] [方案 B 代码]
    现在产品说：加一个"合规审查" section，只在欧盟用户看到。
    在方案 A 里你要做什么？在方案 B 里你要做什么？关键差异在哪？

User: A方案要加一个if-else，B方案只需要添加pipe

AI: 方向对，但说得还不够精准。
    让我追问一个细节：方案 A 里的条件判断写在"哪里"？
    而方案 B 里"判断要不要出现"的逻辑写在"哪里"？
    这个位置的差异，才是 Pipe 模式真正的工程优势。

User: B在自己的文件里面，A杂糅在一起了

AI: 你说到点子上了。
    方案 A 里判断逻辑散落在中心文件各处，
    方案 B 里判断逻辑和 prompt 内容内聚在同一个函数里——这就是关键差别。

    → [已记录擅长项]

    本质上这是单一职责原则在 prompt 工程上的应用。
    过了。你抓住了 Pipe 模式的核心。
```

### 4.2 评估卡片示例

```
┌──────────────────────────────────────────────┐
│ Prompt Pipe 节点回顾                           │
│                                               │
│ ┌─────────────────────┬───────────┬────────┐ │
│ │ 要点                 │ 你的回答    │        │ │
│ ├─────────────────────┼───────────┼────────┤ │
│ │ 加新section的差异     │ B在自己的  │ 准确   │ │
│ │                     │ 文件里     │        │ │
│ │ KV Cache失效方向     │ 动态放前面  │ 准确   │ │
│ │ return null的意义   │ 坦诚不清楚  │ 已补充  │ │
│ └─────────────────────┴───────────┴────────┘ │
│                                               │
│ 核心要点：[单一职责] [零摩擦扩展]               │
│           [return null = 入口管理] [中心只编排] │
│                                               │
│ 下一节 → 静态/动态分界线与 Prompt Cache          │
└──────────────────────────────────────────────┘
```
