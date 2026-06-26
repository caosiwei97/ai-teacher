import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TOPIC = "React Hooks 原理与使用";
const USER_ID = "seed-user-ai-teacher";
const SESSION_ID = "seed-session-react-hooks";
const ROADMAP_ID = "seed-roadmap-react-hooks";
const PDF_SOURCE_ID = "seed-source-react-hooks-pdf";
const MARKDOWN_SOURCE_ID = "seed-source-react-hooks-markdown";
const BASE_TIME = new Date("2026-05-08T09:00:00.000Z");

const roadmapNodes = [
  {
    id: "seed-node-use-state",
    title: "理解 useState：组件状态从哪里来",
    description:
      "掌握 useState 的基本签名、初始值设置、函数式更新，以及状态更新为什么会触发重新渲染。",
    status: "mastered",
    masteryScore: 88,
    reviewLog: {
      latestAssessment: "能够正确解释批量更新与函数式 setState 的使用场景。",
      nextStep: "将状态拆分为更小的原子状态，减少不必要的重渲染。",
    },
    masteredAt: new Date("2026-05-08T09:05:00.000Z"),
  },
  {
    id: "seed-node-use-effect",
    title: "理解 useEffect：副作用、依赖与清理",
    description:
      "学习 useEffect 的执行时机、依赖数组的含义、闭包陷阱，以及如何编写正确的清理逻辑。",
    status: "in_progress",
    masteryScore: 52,
    reviewLog: {
      currentFocus: "区分首次执行、依赖变更执行和卸载时清理。",
      blocker: "对依赖数组遗漏导致的陈旧闭包还不够敏感。",
    },
    masteredAt: null,
  },
  {
    id: "seed-node-use-context",
    title: "理解 useContext：跨层级共享状态",
    description:
      "理解 Context Provider 与 Consumer 的关系，掌握 useContext 读取共享数据的方式，并了解何时不适合用 Context。",
    status: "not_started",
    masteryScore: 0,
    reviewLog: null,
    masteredAt: null,
  },
  {
    id: "seed-node-use-memo-callback",
    title: "理解 useMemo / useCallback：性能优化不是越多越好",
    description:
      "学习 useMemo 与 useCallback 的适用场景，理解引用稳定性、记忆化成本，以及如何避免过度优化。",
    status: "not_started",
    masteryScore: 0,
    reviewLog: null,
    masteredAt: null,
  },
  {
    id: "seed-node-custom-hooks",
    title: "编写自定义 Hooks：抽离可复用的状态逻辑",
    description:
      "将 useState、useEffect、useContext 等组合成自定义 Hooks，形成更清晰、可复用、可测试的业务抽象。",
    status: "not_started",
    masteryScore: 0,
    reviewLog: null,
    masteredAt: null,
  },
];

const messages = [
  {
    id: "seed-message-system-react-hooks",
    role: "system",
    type: "system",
    content:
      "你是一位擅长苏格拉底式提问的 React 导师，需要围绕 React Hooks 原理与使用，引导学习者自己推导结论。",
    metadata: {
      topic: TOPIC,
      teachingMode: "socratic",
    },
    createdAt: new Date(BASE_TIME.getTime()),
  },
  {
    id: "seed-message-tutor-greeting",
    role: "tutor",
    type: "text",
    content:
      "你好，我们今天会从 React Hooks 的设计动机讲起。你可以先说说你对 useState 和 useEffect 的区别有哪些初步理解吗？",
    metadata: {
      nodeId: "seed-node-use-state",
      intent: "greeting",
    },
    createdAt: new Date(BASE_TIME.getTime() + 60_000),
  },
  {
    id: "seed-message-learner-response",
    role: "learner",
    type: "text",
    content:
      "我知道 useState 是用来保存组件内部状态的，useEffect 好像是处理副作用，但我还不太清楚依赖数组为什么会影响执行时机。",
    metadata: {
      confidence: "medium",
      currentQuestion: "依赖数组与执行时机的关系",
    },
    createdAt: new Date(BASE_TIME.getTime() + 120_000),
  },
  {
    id: "seed-message-tutor-follow-up",
    role: "tutor",
    type: "quiz",
    content:
      "如果一个 effect 中访问了 props.userId，但依赖数组写成 []，你觉得会发生什么问题？请先尝试自己推理。",
    metadata: {
      nodeId: "seed-node-use-effect",
      questionType: "open-ended",
    },
    createdAt: new Date(BASE_TIME.getTime() + 180_000),
  },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { id: USER_ID },
    update: {
      name: "AI Teacher 测试用户",
    },
    create: {
      id: USER_ID,
      name: "AI Teacher 测试用户",
    },
  });

  await prisma.learnerProfile.upsert({
    where: { userId: user.id },
    update: {
      learningStyle: {
        preference: "concept-first",
        pace: "interactive",
      },
      strengths: ["JavaScript 基础较扎实", "愿意主动总结"],
      weaknesses: ["对副作用执行时机理解不稳定", "性能优化经验较少"],
      misconceptionPatterns: [
        "容易把 useEffect 当成生命周期函数的简单替代",
        "认为 useMemo 一定能提升性能",
      ],
      sessionsSummary: {
        totalSessions: 1,
        activeTopic: TOPIC,
      },
    },
    create: {
      id: "seed-learner-profile-ai-teacher",
      userId: user.id,
      learningStyle: {
        preference: "concept-first",
        pace: "interactive",
      },
      strengths: ["JavaScript 基础较扎实", "愿意主动总结"],
      weaknesses: ["对副作用执行时机理解不稳定", "性能优化经验较少"],
      misconceptionPatterns: [
        "容易把 useEffect 当成生命周期函数的简单替代",
        "认为 useMemo 一定能提升性能",
      ],
      sessionsSummary: {
        totalSessions: 1,
        activeTopic: TOPIC,
      },
    },
  });

  await Promise.all([
    prisma.source.upsert({
      where: { id: PDF_SOURCE_ID },
      update: {
        userId: user.id,
        title: "React Hooks 原理详解（PDF）",
        type: "pdf",
        content:
          "React Hooks PDF 摘要：从函数组件状态管理、闭包问题，到副作用与性能优化策略的系统讲解。",
        fileUrl: "https://example.com/files/react-hooks-guide.pdf",
        checksum: "seed-checksum-react-hooks-pdf-v1",
      },
      create: {
        id: PDF_SOURCE_ID,
        userId: user.id,
        title: "React Hooks 原理详解（PDF）",
        type: "pdf",
        content:
          "React Hooks PDF 摘要：从函数组件状态管理、闭包问题，到副作用与性能优化策略的系统讲解。",
        fileUrl: "https://example.com/files/react-hooks-guide.pdf",
        checksum: "seed-checksum-react-hooks-pdf-v1",
      },
    }),
    prisma.source.upsert({
      where: { id: MARKDOWN_SOURCE_ID },
      update: {
        userId: user.id,
        title: "react-hooks-learning-notes.md",
        type: "markdown",
        content: `# React Hooks 学习笔记

## 为什么需要 Hooks
- 让函数组件也能管理状态和副作用
- 更容易复用状态逻辑

## 核心 Hooks
1. useState
2. useEffect
3. useContext
4. useMemo / useCallback
5. 自定义 Hooks
`,
        fileUrl: "https://example.com/files/react-hooks-learning-notes.md",
        checksum: "seed-checksum-react-hooks-markdown-v1",
      },
      create: {
        id: MARKDOWN_SOURCE_ID,
        userId: user.id,
        title: "react-hooks-learning-notes.md",
        type: "markdown",
        content: `# React Hooks 学习笔记

## 为什么需要 Hooks
- 让函数组件也能管理状态和副作用
- 更容易复用状态逻辑

## 核心 Hooks
1. useState
2. useEffect
3. useContext
4. useMemo / useCallback
5. 自定义 Hooks
`,
        fileUrl: "https://example.com/files/react-hooks-learning-notes.md",
        checksum: "seed-checksum-react-hooks-markdown-v1",
      },
    }),
  ]);

  const session = await prisma.session.upsert({
    where: { id: SESSION_ID },
    update: {
      userId: user.id,
      topic: TOPIC,
      sourceId: PDF_SOURCE_ID,
      status: "active",
    },
    create: {
      id: SESSION_ID,
      userId: user.id,
      topic: TOPIC,
      sourceId: PDF_SOURCE_ID,
      status: "active",
    },
  });

  const roadmap = await prisma.roadmap.upsert({
    where: { sessionId: session.id },
    update: {
      version: 1,
    },
    create: {
      id: ROADMAP_ID,
      sessionId: session.id,
      version: 1,
    },
  });

  await prisma.node.deleteMany({
    where: { roadmapId: roadmap.id },
  });

  await prisma.node.createMany({
    data: roadmapNodes.map((node, index) => ({
      id: node.id,
      roadmapId: roadmap.id,
      index,
      title: node.title,
      description: node.description,
      status: node.status,
      masteryScore: node.masteryScore,
      reviewLog: node.reviewLog ?? Prisma.DbNull,
      masteredAt: node.masteredAt,
    })),
  });

  await prisma.message.deleteMany({
    where: { sessionId: session.id },
  });

  await prisma.message.createMany({
    data: messages.map((message) => ({
      id: message.id,
      sessionId: session.id,
      role: message.role,
      type: message.type,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt,
    })),
  });

  console.log("Seed completed successfully.");
  console.log(`User: ${user.id}`);
  console.log(`Sources: ${PDF_SOURCE_ID}, ${MARKDOWN_SOURCE_ID}`);
  console.log(`Session: ${session.id}`);
  console.log(`Roadmap nodes: ${roadmapNodes.length}`);
  console.log(`Messages: ${messages.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
