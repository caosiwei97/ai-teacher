import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should show welcome content on homepage", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    await expect(page).toHaveURL("/");

    await expect(
      page.getByText("你好，我是 AI Teacher"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show suggested topic cards", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("或者试试这些"),
    ).toBeVisible({ timeout: 10000 });

    const topicCards = page.locator("button", { hasText: "文艺复兴" });
    await expect(topicCards.first()).toBeVisible();
  });

  test("should show topic input", async ({ page }) => {
    await page.goto("/");

    const input = page.getByPlaceholder("你想学什么？");
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test("should create session and navigate on input submit", async ({
    page,
  }) => {
    await page.goto("/");

    const input = page.getByPlaceholder("你想学什么？");
    await expect(input).toBeVisible({ timeout: 10000 });

    await input.fill("测试学习主题");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/learn\//, { timeout: 15000 });
  });
});
