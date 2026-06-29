import { Hono } from "hono";
import { InterviewService } from "@ai-teacher/shared/services/interview-service";

// 面试模式 API（spec §4，迭代 052②）
// 挂载于 /api/sessions/:sessionId/interview
export const interviewRoute = new Hono()
  // 查询最新面试结果（评分卡/复盘，③ UI 用）
  .get("/result", async (c) => {
    const sessionId = c.req.param("sessionId");
    if (!sessionId) return c.json({ error: "sessionId is required" }, 400);
    const result = await InterviewService.getResult(sessionId);
    return c.json({ result });
  });
