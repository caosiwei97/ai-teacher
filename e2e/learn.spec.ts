import { test, expect } from "@playwright/test";

const LEARN_PATH = "/learn/seed-session-react-hooks";

test.describe("Learn Page — Layout", () => {
  test("should load three-column layout", async ({ page }) => {
    await page.goto(LEARN_PATH);
    await expect(page).toHaveTitle(/AI Teacher/);

    const body = page.locator("body");
    await expect(body).toBeVisible();

    const leftSidebar = page.locator('[class*="flex-col"]').first();
    await expect(leftSidebar).toBeVisible();
  });

  test("should show session list in left sidebar", async ({ page }) => {
    await page.goto(LEARN_PATH);
    await page.waitForSelector("text=AI Teacher", { timeout: 10000 });

    const sessionItems = page.locator("button", { hasText: "React Hooks" });
    await expect(sessionItems).toBeVisible();
  });

  test("should have dark background on left sidebar", async ({ page }) => {
    await page.goto(LEARN_PATH);
    await page.waitForSelector("text=AI Teacher", { timeout: 10000 });

    const sidebar = page.locator('[class*="flex-col"]').first();
    const bgColor = await sidebar.evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });

    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("rgb(255, 255, 255)");
  });
});

test.describe("Learn Page — Roadmap", () => {
  test("should show roadmap with progress", async ({ page }) => {
    await page.goto(LEARN_PATH);

    const roadmapHeader = page.locator("text=学习路线");
    await expect(roadmapHeader).toBeVisible();

    const node = page.locator("p", { hasText: "useState" });
    await expect(node.first()).toBeVisible();
  });
});

test.describe("Learn Page — Chat Input", () => {
  test("should display textarea with placeholder", async ({ page }) => {
    await page.goto(LEARN_PATH);

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("placeholder", "写下你的思考…");
  });
});
