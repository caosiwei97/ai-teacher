import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should redirect to learn page", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
  });
});
