import { test, expect } from "@playwright/test";

// 落地页（spec §5.3①，迭代 053② 重写 home.tsx 为落地页，替代纯重定向）

test.describe("Home Page — 落地页", () => {
  test("should show landing page with title and input", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("真正掌握，而不只是看过")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("input[placeholder*='想学的主题']")).toBeVisible();
  });

  test("should show suggested topic chips", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("AI 提示词工程").first()).toBeVisible({ timeout: 10000 });
  });

  test("should show three-stage closure", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("🌱 学习")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("🔁 复习")).toBeVisible();
    await expect(page.getByText("🔥 面试")).toBeVisible();
  });

  test("should navigate to learn page on topic submit", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await expect(page.getByText("真正掌握，而不只是看过")).toBeVisible({ timeout: 10000 });

    const input = page.locator("input[placeholder*='想学的主题']");
    await input.fill("测试学习主题");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/learn\//, { timeout: 30000 });
  });

  test("should show welcome content for new session without topic state", async ({ page }) => {
    // 直接 goto 不存在 session（无 topic state）→ 欢迎页（非起步页）
    await page.goto("/learn/e2e-test-new-session-welcome");
    await expect(page.getByText("你好，我是 AI Teacher")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("或者试试这些")).toBeVisible();
  });
});
