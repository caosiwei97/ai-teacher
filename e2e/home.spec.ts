import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should redirect to active session", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });
  });

  test("should load learn page after redirect", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
