import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should show session list dashboard", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    await expect(page).toHaveURL("/");

    await expect(page.locator("h1")).toContainText("AI Teacher");

    const sessionCards = page.locator("button.border-l-\\[3px\\]");
    await expect(sessionCards.first()).toBeVisible({ timeout: 10000 });
  });

  test("should have new session input form", async ({ page }) => {
    await page.goto("/");

    const input = page.locator('input[placeholder*="React Hooks"]');
    await expect(input).toBeVisible();

    const submitBtn = page.locator("button", { hasText: "开始" });
    await expect(submitBtn).toBeVisible();
  });
});
