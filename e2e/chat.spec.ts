import { test, expect } from "@playwright/test";

const LEARN_PATH = "/learn/seed-session-react-hooks";

test.describe("Chat — Message Flow", () => {
  test("should send message and receive AI response", async ({ page }) => {
    await page.goto(LEARN_PATH);

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    await textarea.fill("什么是useState？");

    const form = page.locator("form");
    await form.evaluate((el) => {
      el.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    await page.waitForSelector('[class*="rounded-xl"]', { timeout: 15000 });

    const messages = page.locator('[class*="rounded-xl"]');
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const usageMeter = page.getByTestId("token-usage-meter");
    await expect(usageMeter).toBeVisible({ timeout: 15000 });
    await expect(usageMeter).toContainText("上下文");

    await usageMeter.locator("summary").click();
    await expect(usageMeter).toContainText("本轮输入");
    await expect(usageMeter).toContainText("会话累计");
  });
});
