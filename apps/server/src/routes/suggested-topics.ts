import { Hono } from "hono";

const suggestedTopics = [
  { id: "topic-1", icon: "Brain", title: "JavaScript 闭包" },
  { id: "topic-2", icon: "Heart", title: "认知行为疗法入门" },
  { id: "topic-3", icon: "Utensils", title: "营养学基础" },
  { id: "topic-4", icon: "Landmark", title: "文艺复兴艺术" },
  { id: "topic-5", icon: "MessageSquare", title: "高效沟通技巧" },
  { id: "topic-6", icon: "TrendingUp", title: "概率思维" },
];

export const suggestedTopicsRoute = new Hono().get("/", (c) => {
  return c.json({ topics: suggestedTopics });
});
