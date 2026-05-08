import { z } from "zod";

export const RoadmapNodeOutput = z.object({
  index: z.number().int().min(0).describe("节点序号，从 0 开始"),
  title: z.string().max(30).describe("知识点标题，简洁"),
  description: z.string().max(100).describe("一句话说明要学什么"),
});

export const RoadmapOutput = z.object({
  title: z.string().describe("学习路线标题"),
  nodes: z.array(RoadmapNodeOutput).min(5).max(15).describe("知识点节点列表，按学习顺序排列"),
});

export type RoadmapNodeOutput = z.infer<typeof RoadmapNodeOutput>;
export type RoadmapOutput = z.infer<typeof RoadmapOutput>;
