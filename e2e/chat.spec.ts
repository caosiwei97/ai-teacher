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

    const contextButton = page.getByRole("button", {
      name: "查看 Prompt 上下文",
    });
    await expect(contextButton).toBeVisible({ timeout: 15000 });
    await contextButton.click();

    const usageMeter = page.getByTestId("token-usage-meter");
    await expect(usageMeter).toBeVisible();
    await expect(usageMeter).toContainText("Prompt 上下文");
    await expect(usageMeter).toContainText("系统消息");
    await expect(usageMeter).toContainText("内置工具");
    await expect(usageMeter).toContainText("缓存命中率");
  });
});
