import { test, expect } from "@playwright/test";

// 分类 T — 模式切换与渐进解锁（迭代 053③，spec §5.1/§5.2/§9.2 Phase 4）
// 覆盖：三模式顶部 Tab + Tab 切换 URL 不变（状态变化非跳转）+ 渐进解锁两态 + 响应式三断点

const REACT_HOOKS_SESSION = "seed-session-react-hooks"; // 1 mastered，复习/面试解锁

test.describe("Mode Switch — 模式切换与渐进解锁（分类 T）", () => {
  test("三模式顶部 Tab 可见", async ({ page }) => {
    await page.goto(`/learn/${REACT_HOOKS_SESSION}`);
    await page.waitForSelector("textarea");

    const tabs = page.getByTestId("mode-tabs");
    await expect(tabs.locator("button", { hasText: "学习" })).toBeVisible();
    await expect(tabs.locator("button", { hasText: "复习" })).toBeVisible();
    await expect(tabs.locator("button", { hasText: "面试" })).toBeVisible();
  });

  test("Tab 切换是状态变化：URL 不变 + 右栏切换", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`/learn/${REACT_HOOKS_SESSION}`);
    await page.waitForSelector("textarea");

    const urlBefore = page.url();

    // 点复习 Tab（mastered≥1 解锁）→ 触发复习模式
    await page.getByTestId("mode-tabs").locator("button", { hasText: "复习" }).click();

    // URL 不变（状态变化非跳转，spec §5.1）
    await expect(page).toHaveURL(urlBefore);

    // 右栏切换到复习清单
    await expect(page.locator("text=今日复习")).toBeVisible({ timeout: 10000 });
  });

  test("渐进解锁：≥1 mastered 时复习/面试 Tab 解锁", async ({ page }) => {
    await page.goto(`/learn/${REACT_HOOKS_SESSION}`);
    await page.waitForSelector("textarea");

    const tabs = page.getByTestId("mode-tabs");
    await expect(tabs.locator("button", { hasText: "复习" })).not.toBeDisabled();
    await expect(tabs.locator("button", { hasText: "面试" })).not.toBeDisabled();
  });

  test("渐进解锁：0 知识点时复习/面试 Tab 灰锁", async ({ page }) => {
    // 新建会话（无 roadmap，0 mastered）→ 复习/面试灰锁
    await page.goto("/learn/e2e-test-mode-switch-empty");
    await page.waitForSelector("textarea");

    const tabs = page.getByTestId("mode-tabs");
    await expect(tabs.locator("button", { hasText: "复习" })).toBeDisabled();
    await expect(tabs.locator("button", { hasText: "面试" })).toBeDisabled();
  });

  test("响应式：lg(1280) 顶部 Tab + 输入区可见", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/learn/${REACT_HOOKS_SESSION}`);
    await page.waitForSelector("textarea");

    await expect(page.getByTestId("mode-tabs")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("响应式：<lg(900) 右栏隐藏", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto(`/learn/${REACT_HOOKS_SESSION}`);
    await page.waitForSelector("textarea");

    // 右栏 hidden lg:block → <lg 不可见（学习路线在右栏 roadmap panel）
    await expect(page.locator("text=学习路线")).not.toBeVisible();
  });
});
