import { test, expect } from "@playwright/test";

// 分类 S — 面试模式（迭代 052③，spec §4 / §9.2 Phase 3）
// 覆盖：面试入口（右栏 面试 tab）+ scoreAnswer 评分/难度调整 + finalizeInterview 评分卡/复盘
// "全程不讲解"为 prompt 行为，由 interview.test.ts 单测 + ② dev 真实 LLM 走查覆盖（mock 不便断言）

const REACT_HOOKS_SESSION = "seed-session-react-hooks";
const REVIEW_MULTI_SESSION = "seed-session-review-multi"; // 2 mastered，面试 mock 流程用（避免污染 react-hooks 共享会话）

test.describe("Interview — 面试模式（分类 S）", () => {
  test("面试入口：顶部面试 Tab 可见 + 初始无结果", async ({ page, request }) => {
    await page.goto(`/learn/${REACT_HOOKS_SESSION}`);
    await page.waitForSelector("textarea");

    // 顶部面试 Tab（🔥）可见（spec §5.1 顶部 Tab 替代右栏 tab）
    await expect(page.locator("button", { hasText: "面试" })).toBeVisible();

    // 初始无面试结果
    const res = await request.get(
      `/api/sessions/${REACT_HOOKS_SESSION}/interview/result`,
    );
    const { result } = await res.json();
    expect(result).toBeNull();
  });

  test("面试结果接口返回 200 不崩溃", async ({ request }) => {
    const res = await request.get(
      `/api/sessions/${REACT_HOOKS_SESSION}/interview/result`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("result");
  });

  test("scoreAnswer 评分 + finalizeInterview 评分卡（mock LLM）", async ({ page, request }) => {
    test.setTimeout(60000);
    // 用 review-multi 会话（2 mastered）跑面试 mock 流程，避免污染 react-hooks 共享会话
    // PATCH 切面试模式（避开开始面试按钮触发的 chat loading 竞态）
    await request.patch(`/api/sessions/${REVIEW_MULTI_SESSION}`, {
      data: { activeMode: "interview" },
    });
    await page.goto(`/learn/${REVIEW_MULTI_SESSION}`);
    await page.waitForSelector("textarea");

    // [score-answer] → scoreAnswer tool call → InterviewResult 更新（questionLog + 难度）
    const textarea = page.locator("textarea");
    await textarea.fill("[score-answer]");
    await page.locator("form").evaluate((el) =>
      el.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    // 等工具调用后的默认回复（mock 守卫防循环）
    await expect(page.locator("text=模拟回复")).toBeVisible({ timeout: 20000 });

    // 面试结果已更新：in_progress + questionLog 非空
    const res1 = await request.get(
      `/api/sessions/${REVIEW_MULTI_SESSION}/interview/result`,
    );
    const { result: r1 } = await res1.json();
    expect(r1.status).toBe("in_progress");
    expect(r1.questionLog.length).toBeGreaterThanOrEqual(1);

    // [finalize-interview] → finalizeInterview + renderUI(interviewScore) 评分卡
    await textarea.fill("[finalize-interview]");
    await page.locator("form").evaluate((el) =>
      el.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    // 评分卡渲染
    await expect(page.locator("text=面试评分卡")).toBeVisible({ timeout: 20000 });

    // 面试结果已 completed + totalScore
    const res2 = await request.get(
      `/api/sessions/${REVIEW_MULTI_SESSION}/interview/result`,
    );
    const { result: r2 } = await res2.json();
    expect(r2.status).toBe("completed");
    expect(r2.totalScore).toBeGreaterThanOrEqual(0);
    expect(r2.weakPoints.length).toBeGreaterThan(0);
    expect(r2.improvement).toBeTruthy();
  });
});
