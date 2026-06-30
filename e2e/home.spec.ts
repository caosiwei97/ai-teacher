import { test, expect } from "@playwright/test";

// 落地页（spec §5.3①，迭代 053② 重写 home.tsx 为落地页，替代纯重定向）

test.describe("Home Page — 落地页", () => {
  test("should show landing page with title and input", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("真正掌握，而不只是看过")).toBeVisible({ timeout: 10000 });
    // 落地页复用 ChatInput（textarea），含教学模式选择 + 文件上传
    await expect(page.locator("textarea")).toBeVisible({ timeout: 10000 });
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

    // 新机制：发消息才建会话——输入消息发送 → POST /api/sessions 拿 id → 跳 /learn/:id
    const textarea = page.locator("textarea").first();
    await textarea.fill("测试学习主题");
    await textarea.press("Enter");

    await expect(page).toHaveURL(/\/learn\//, { timeout: 30000 });
  });

  test("should show error for non-existent session without topic state", async ({ page }) => {
    // 直接 goto 不存在 session（无 topic state）→ 显示「会话不存在」错误
    // 改造后落地页是唯一新建入口，带 id 路由找不到会话属异常（不再创建空占位）
    await page.goto("/learn/e2e-test-new-session-welcome");
    await expect(page.getByText("会话不存在")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Left Sidebar — 分类折叠与空态", () => {
  test("学习中/已完成分类始终展示（即使空）+ 可折叠", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("真正掌握，而不只是看过")).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator(".bg-sidebar").first();

    // 两个分类标题始终可见（标题按钮内含 chevron + 数量，用 hasText 定位）
    await expect(sidebar.locator("button", { hasText: "学习中" })).toBeVisible();
    await expect(sidebar.locator("button", { hasText: "已完成" })).toBeVisible();

    // 已完成分类在 seed 环境为空 → 显示「暂无对话」
    await expect(sidebar.getByText("暂无对话").first()).toBeVisible();

    // 点击「已完成」分类标题折叠 → 「暂无对话」消失
    const completedHeader = sidebar.locator("button", { hasText: "已完成" });
    await completedHeader.click();
    await expect(sidebar.getByText("暂无对话")).toHaveCount(0);

    // 再点击展开 → 「暂无对话」重新出现
    await completedHeader.click();
    await expect(sidebar.getByText("暂无对话").first()).toBeVisible();
  });
});
