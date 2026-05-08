import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should redirect to first active session", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    await expect(page).toHaveURL(/\/learn\//);
  });
});
