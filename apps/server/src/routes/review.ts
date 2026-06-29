import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ReviewService } from "@ai-teacher/shared/services/review-service";
import { SubmitReviewResultInputSchema } from "@ai-teacher/shared";

// 复习模式 API（spec §3，迭代 051②）
// 挂载于 /api/sessions/:sessionId/review
export const reviewRoute = new Hono()
  // 今日到期复习清单（智能推荐，§3.1）
  .get("/due", async (c) => {
    const sessionId = c.req.param("sessionId");
    if (!sessionId) return c.json({ error: "sessionId is required" }, 400);
    const due = await ReviewService.getDueNodes(sessionId);
    return c.json({ dueNodes: due });
  })
  // 提交复习结果，更新记忆强度（抽认卡自评入口，§3.3）
  .post("/result", zValidator("json", SubmitReviewResultInputSchema), async (c) => {
    const { nodeId, correct } = c.req.valid("json");
    try {
      const result = await ReviewService.submitResult(nodeId, correct);
      return c.json({ result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 404);
    }
  })
  // 薄弱点汇总（错题本，§3.3 结束输出）
  .get("/summary", async (c) => {
    const sessionId = c.req.param("sessionId");
    if (!sessionId) return c.json({ error: "sessionId is required" }, 400);
    const summary = await ReviewService.getSummary(sessionId);
    return c.json({ summary });
  });
