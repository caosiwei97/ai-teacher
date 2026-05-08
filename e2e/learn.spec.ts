import { test, expect } from "@playwright/test";

test.describe("Learn Page - Core Layout", () => {
  test("should load three-column layout with styles", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");

    await expect(page).toHaveTitle(/AI Teacher/);

    const body = page.locator("body");
    await expect(body).toBeVisible();

    const leftSidebar = page.locator('[class*="flex-col"]').first();
    await expect(leftSidebar).toBeVisible();
  });

  test("should show session list in left sidebar", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");

    await page.waitForSelector("text=AI Teacher", { timeout: 10000 });

    const sessionItems = page.locator("button", { hasText: "React Hooks" });
    await expect(sessionItems).toBeVisible();
  });

  test("should show roadmap nodes in right sidebar", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");

    const roadmapHeader = page.locator("text=学习路线");
    await expect(roadmapHeader).toBeVisible();

    const node = page.locator("p", { hasText: "useState" });
    await expect(node.first()).toBeVisible();
  });

  test("should display chat area with input", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("placeholder", "写下你的思考…");
  });

  test("should have dark background on left sidebar", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");
    await page.waitForSelector("text=AI Teacher", { timeout: 10000 });

    const sidebar = page.locator('[class*="flex-col"]').first();
    const bgColor = await sidebar.evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });

    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("rgb(255, 255, 255)");
  });
});

test.describe("Chat Interaction", () => {
  test("should send message and receive AI response", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    await textarea.fill("什么是useState？");

    const form = page.locator("form");
    await form.evaluate((el) => {
      el.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    await page.waitForSelector('[class*="rounded-2xl"]', { timeout: 15000 });

    const messages = page.locator('[class*="rounded-2xl"]');
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Home Page", () => {
  test("should load home page or redirect to learn", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
  });
});
