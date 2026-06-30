import { test, expect } from "@playwright/test";

// 分类 Q — 互动教学产物（结构化 A2UI 渲染）
// mock LLM 检测消息含 [render-interactive] → 返回 renderUI(interactive) tool call →
// agent loop 执行 renderUI → SSE ui-blocks → 前端 React 结构化渲染 → 点选项断言即时反馈

test.describe("Interactive Lesson — 结构化 A2UI 渲染（分类 Q）", () => {
  test("interactive block 结构化渲染可交互（点选项断言即时反馈与提交续接）", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/learn/seed-session-react-hooks");
    await page.waitForSelector("textarea");

    const textarea = page.locator("textarea");
    await textarea.fill("[render-interactive]");
    await page.locator("form").evaluate((el) =>
      el.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );

    // 结构化卡片渲染完成
    await expect(page.getByTestId("interactive-lesson-card")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("互动体验小测")).toBeVisible();
    await expect(page.getByText("等待作答")).toBeVisible();

    // 动手感受：滑块可交互
    await expect(page.getByTestId("interactive-explore-0")).toBeVisible({ timeout: 20000 });
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // 自测：点正确选项 → 断言即时反馈
    await page.getByTestId("interactive-option-a").click();
    await expect(page.getByTestId("interactive-quiz-feedback")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("答对了")).toBeVisible();

    // 点「完成自测」→ 断言提交态
    await page.getByTestId("interactive-complete-button").click();
    await expect(page.getByTestId("interactive-submit-status")).toBeVisible({ timeout: 10000 });

    // 互动课提交后应自动触发下一轮，而不是停在卡片处
    await expect(page.getByText("收到你的互动结果，我们继续往下看下一步判断。")).toBeVisible({ timeout: 30000 });
  });
});
