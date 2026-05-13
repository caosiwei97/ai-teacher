import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test("should load settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "模型设置" })).toBeVisible({ timeout: 10000 });
  });

  test("should show settings page content", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "模型设置" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("添加新配置")).toBeVisible({ timeout: 10000 });
  });

  test("should show add config button", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("添加新配置")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show provider grid when clicking add", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("添加新配置")).toBeVisible({ timeout: 10000 });
    await page.getByText("添加新配置").click();
    await expect(page.getByText("选择你的 AI 服务商")).toBeVisible();
    await expect(page.getByRole("button", { name: "DeepSeek" })).toBeVisible();
    await expect(page.getByRole("button", { name: "OpenAI", exact: true })).toBeVisible();
  });

  test("should navigate to step 2 after selecting provider", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByText("添加新配置")).toBeVisible({ timeout: 10000 });
    await page.getByText("添加新配置").click();
    await page.getByRole("button", { name: "DeepSeek" }).click();
    await expect(page.getByText("API Key")).toBeVisible();
  });

  test("should show model selector in step 3", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("添加新配置")).toBeVisible({ timeout: 10000 });
    await page.getByText("添加新配置").click();
    await page.getByRole("button", { name: "DeepSeek" }).click();

    const apiKeyInput = page.locator('input[type="password"]');
    await apiKeyInput.fill("sk-test-fake-key-for-e2e");
    await page.getByText("下一步").click();

    await expect(page.getByText("选择模型")).toBeVisible({ timeout: 10000 });
  });

  test("should have back to home navigation", async ({ page }) => {
    await page.goto("/settings");
    const backButton = page.locator("button").filter({ has: page.locator("svg").first() }).first();
    await expect(backButton).toBeVisible({ timeout: 10000 });
  });
});
