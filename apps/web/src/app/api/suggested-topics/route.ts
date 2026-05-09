import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const suggestedTopics = [
  { id: "topic-1", icon: "Brain", title: "深入理解 JavaScript 闭包" },
  { id: "topic-2", icon: "Heart", title: "认知行为疗法入门与实践" },
  { id: "topic-3", icon: "Utensils", title: "营养学基础：科学搭配三餐" },
  { id: "topic-4", icon: "Landmark", title: "文艺复兴：艺术与科学交汇" },
  { id: "topic-5", icon: "MessageSquare", title: "高效沟通：用逻辑说服他人" },
  { id: "topic-6", icon: "TrendingUp", title: "概率思维：做出更明智的决策" },
];

export async function GET() {
  return NextResponse.json({ topics: suggestedTopics });
}
