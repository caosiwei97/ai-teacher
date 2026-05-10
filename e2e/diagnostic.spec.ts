import { test, expect } from "@playwright/test";

const USER_ID = "seed-user-ai-teacher";

test.describe("Diagnostic — Chat-Inline Diagnosis", () => {
  test("should create session with active status and fallback nodes", async ({ request }) => {
    test.setTimeout(60000);

    const response = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "CSS Grid 布局" },
    });
    expect(response.ok()).toBeTruthy();

    const { session } = await response.json();
    expect(session.status).toBe("active");
    expect(session.roadmap.nodes.length).toBe(5);
    const notStartedCount = session.roadmap.nodes.filter(
      (n: { status: string }) => n.status === "not-started",
    ).length;
    expect(notStartedCount).toBe(5);
  });

  test("should enter chat directly on learn page for new session", async ({ page, request }) => {
    test.setTimeout(60000);

    const response = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "TypeScript 泛型入门" },
    });
    const { session } = await response.json();

    await page.goto(`/learn/${session.id}`);

    await expect(
      page.getByText("开始你的学习之旅吧"),
    ).toBeVisible({ timeout: 10000 });
  });
});
