import { test, expect } from "@playwright/test";

// 分类 Q — 互动教学产物（迭代 050②）
// mock LLM 检测消息含 [render-interactive] → 返回 renderUI(interactive) tool call →
// agent loop 执行 renderUI → SSE ui-blocks → 前端 iframe 沙箱渲染 → frameLocator 进 iframe 测交互

test.describe("Interactive Lesson — iframe 沙箱渲染（分类 Q）", () => {
  test("interactive block 在 iframe 沙箱内可交互（点按钮断言状态变化）", async ({
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

    // iframe 沙箱渲染完成
    const iframe = page.frameLocator('iframe[title="互动教学产物"]');
    await expect(iframe.locator("#btn")).toBeVisible({ timeout: 20000 });

    // 点按钮 → 断言状态变化（沙箱内脚本执行）
    await iframe.locator("#btn").click();
    await expect(iframe.locator("#out")).toHaveText("已点击");
  });
});
