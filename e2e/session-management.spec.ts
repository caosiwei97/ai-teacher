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
    const listRes = await request.get(`/api/sessions?userId=${USER_ID}`);
    const { sessions } = await listRes.json();
    const target = sessions.find(
      (s: { status: string }) => s.status === "completed",
    );

    if (!target) {
      test.skip();
      return;
    }

    const archiveRes = await request.delete(`/api/sessions/${target.id}`);
    expect(archiveRes.ok()).toBeTruthy();

    const { success, session: archived } = await archiveRes.json();
    expect(success).toBe(true);
    expect(archived.status).toBe("archived");

    const listRes2 = await request.get(`/api/sessions?userId=${USER_ID}`);
    const { sessions: sessions2 } = await listRes2.json();
    const found = sessions2.find(
      (s: { id: string }) => s.id === target.id,
    );
    expect(found).toBeUndefined();
  });

  test("should update session status via PATCH", async ({ request }) => {
    const listRes = await request.get(`/api/sessions?userId=${USER_ID}`);
    const { sessions } = await listRes.json();
    const target = sessions[0];

    if (!target) {
      test.skip();
      return;
    }

    const patchRes = await request.patch(`/api/sessions/${target.id}`, {
      data: { status: "completed" },
    });
    expect(patchRes.ok()).toBeTruthy();

    const { session: updated } = await patchRes.json();
    expect(updated.status).toBe("completed");

    const restoreRes = await request.patch(`/api/sessions/${target.id}`, {
      data: { status: target.status === "diagnosing" ? "diagnosing" : "active" },
    });
    if (restoreRes.ok()) {
      const { session: restored } = await restoreRes.json();
      expect(restored).toBeDefined();
    }
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
  test("should redirect to learn page with session cards in sidebar", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const sidebar = page.locator(".bg-sidebar-bg");
    await expect(sidebar).toBeVisible();

    const sessionButtons = sidebar.locator("button");
    const count = await sessionButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should show new session button after redirect", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/learn\//, { timeout: 10000 });

    const newBtn = page.locator("button", { hasText: "新建会话" });
    await expect(newBtn).toBeVisible();
  });
});

test.describe("Session Management — Left Sidebar", () => {
  test("should show new session button in sidebar", async ({ page }) => {
    await page.goto("/learn/seed-session-react-hooks");
    await page.waitForSelector("text=学习路线", { timeout: 10000 });

    const newBtn = page.locator("button", { hasText: "新建会话" });
    await expect(newBtn).toBeVisible();
  });

  test("should show session list with progress in sidebar", async ({
    page,
  }) => {
    await page.goto("/learn/seed-session-react-hooks");
    await page.waitForSelector("text=学习路线", { timeout: 10000 });

    const sidebar = page.locator(".bg-sidebar-bg");
    await expect(sidebar).toBeVisible();

    const progressText = sidebar.locator("text=1/5");
    await expect(progressText.first()).toBeVisible();
  });
});
