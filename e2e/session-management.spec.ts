import { test, expect } from "@playwright/test";

const USER_ID = "seed-user-ai-teacher";

test.describe("Session Management — API", () => {
  test("should list sessions excluding archived", async ({ request }) => {
    const response = await request.get(
      `/api/sessions?userId=${USER_ID}`,
    );
    expect(response.ok()).toBeTruthy();

    const { sessions } = await response.json();
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    const archivedSessions = sessions.filter(
      (s: { status: string }) => s.status === "archived",
    );
    expect(archivedSessions.length).toBe(0);
  });

  test("should archive a session via DELETE", async ({ request }) => {
    const createRes = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "待归档测试会话" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { session: created } = await createRes.json();

    const patchRes = await request.patch(`/api/sessions/${created.id}`, {
      data: { status: "completed" },
    });
    expect(patchRes.ok()).toBeTruthy();

    const archiveRes = await request.delete(`/api/sessions/${created.id}`);
    expect(archiveRes.ok()).toBeTruthy();

    const { success, session: archived } = await archiveRes.json();
    expect(success).toBe(true);
    expect(archived.status).toBe("archived");

    const listRes = await request.get(`/api/sessions?userId=${USER_ID}`);
    const { sessions } = await listRes.json();
    const found = sessions.find(
      (s: { id: string }) => s.id === created.id,
    );
    expect(found).toBeUndefined();
  });

  test("should update session status via PATCH", async ({ request }) => {
    const createRes = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "状态变更测试会话" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { session: created } = await createRes.json();

    const patchRes = await request.patch(`/api/sessions/${created.id}`, {
      data: { status: "completed" },
    });
    expect(patchRes.ok()).toBeTruthy();

    const { session: updated } = await patchRes.json();
    expect(updated.status).toBe("completed");

    await request.delete(`/api/sessions/${created.id}`);
  });

  test("should return 404 for non-existent session", async ({ request }) => {
    const deleteRes = await request.delete("/api/sessions/non-existent-id");
    expect(deleteRes.status()).toBe(404);

    const patchRes = await request.patch("/api/sessions/non-existent-id", {
      data: { status: "completed" },
    });
    expect(patchRes.status()).toBe(404);
  });
});

test.describe("Session Management — Home Page", () => {
  test("should show session cards in sidebar on learn page", async ({ page }) => {
    await page.goto("/");

    const sessionItem = page.locator(".bg-sidebar").locator("button", { hasText: "React Hooks" }).first();
    await expect(sessionItem).toBeVisible({ timeout: 10000 });
    await sessionItem.click();

    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const sidebar = page.locator(".bg-sidebar").first();
    await expect(sidebar).toBeVisible();

    const sessionButtons = sidebar.locator("button");
    const count = await sessionButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should show new session button on learn page", async ({
    page,
  }) => {
    await page.goto("/");

    const sessionItem = page.locator(".bg-sidebar").locator("button", { hasText: "React Hooks" }).first();
    await expect(sessionItem).toBeVisible({ timeout: 10000 });
    await sessionItem.click();

    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const newBtn = page.locator("button", { hasText: "新对话" });
    await expect(newBtn).toBeVisible();
  });

  test("should jump to /learn when clicking new session from settings", async ({
    page,
  }) => {
    // 从 /settings 页点「新对话」按钮应跳回 /learn 引导态
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "模型设置" })).toBeVisible({ timeout: 10000 });

    const newBtn = page.locator("button", { hasText: "新对话" });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    await expect(page).toHaveURL(/\/learn$/, { timeout: 10000 });
  });
});

test.describe("Session Management — Left Sidebar", () => {
  test("should show new session button in sidebar", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");
    await page.waitForSelector("textarea", { timeout: 10000 });

    const newBtn = page.locator("button", { hasText: "新对话" });
    await expect(newBtn).toBeVisible();
  });

  test("should show session list with progress in sidebar", async ({
    page,
  }) => {
    await page.goto("/learn/seed-session-react-hooks");
    await page.waitForSelector("textarea", { timeout: 10000 });

    const sidebar = page.locator(".bg-sidebar").first();
    await expect(sidebar).toBeVisible();

    const progressText = sidebar.locator("text=1/5");
    await expect(progressText.first()).toBeVisible();
  });
});
