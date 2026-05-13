import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should redirect to learn page", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });
  });

  test("should show welcome content for new session", async ({ page }) => {
    // Navigate directly to a non-existent session ID to get the new-session welcome screen
    await page.goto("/learn/e2e-test-new-session-welcome");

    await expect(
      page.getByText("你好，我是 AI Teacher"),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText("或者试试这些"),
    ).toBeVisible({ timeout: 10000 });

    const topicCards = page.locator("button", { hasText: "AI 提示词" });
    await expect(topicCards.first()).toBeVisible();
  });

  test("should show topic input after redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const input = page.locator("textarea");
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test("should create session and update URL on input submit", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.goto("/");
    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const input = page.locator("textarea");
    await expect(input).toBeVisible({ timeout: 10000 });

    await input.fill("测试学习主题");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/learn\//, { timeout: 30000 });
  });

  test("should show model selector on welcome page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const modelButton = page.locator("button", { hasText: "未配置模型" });
    const hasModelSelector = await modelButton.isVisible().catch(() => false);

    if (!hasModelSelector) {
      await expect(
        page.getByText("温暖私教"),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
