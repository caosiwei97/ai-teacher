import { Hono } from "hono";

const suggestedTopics = [
  { id: "topic-1", icon: "Brain", title: "AI 提示词工程" },
  { id: "topic-2", icon: "Brain", title: "用 LangGraph 搭建 AI Agent" },
  { id: "topic-3", icon: "Heart", title: "科学减脂与身材管理" },
  { id: "topic-4", icon: "Heart", title: "情绪管理与压力释放" },
  { id: "topic-5", icon: "TrendingUp", title: "个人投资理财入门" },
  { id: "topic-6", icon: "MessageSquare", title: "自媒体运营与个人品牌" },
];

export const suggestedTopicsRoute = new Hono().get("/", (c) => {
  return c.json({ topics: suggestedTopics });
});
