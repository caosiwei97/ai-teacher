import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should load homepage with session list and create input", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    await expect(page.locator("text=开始学习")).toBeVisible();

    const input = page.locator('input[placeholder*="输入你想学的主题"]');
    await expect(input).toBeVisible();

    await expect(
      page.locator("text=React Hooks 原理与使用"),
    ).toBeVisible();
  });
});
