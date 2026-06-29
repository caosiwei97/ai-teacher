import { test, expect } from "@playwright/test";

const USER_ID = "seed-user-ai-teacher";

test.describe("Mastery — Node State Transitions", () => {
  test("seed session should have correct node mastery states", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/sessions/seed-session-react-hooks",
    );
    expect(response.ok()).toBeTruthy();

    const { session } = await response.json();
    const nodes = session.roadmap.nodes;

    expect(nodes.length).toBe(5);
    expect(nodes[0].status).toBe("mastered");
    expect(nodes[0].masteryScore).toBe(88);
    expect(nodes[1].status).toBe("in_progress");
    expect(nodes[1].masteryScore).toBe(52);
    expect(nodes.slice(2).every((n: { status: string }) => n.status === "not_started")).toBeTruthy();
  });

  test("learn page should render roadmap with node mastery states", async ({
    page,
  }) => {
    await page.goto("/learn/seed-session-react-hooks");
    await page.waitForSelector("text=学习路线");

    // 互动课/代码产物可能切走右栏 Tab，点回学习路线 Tab 确保 roadmap 显示
    const roadmapTabBtn = page.locator('button', { hasText: "学习路线" });
    if (await roadmapTabBtn.count() > 0) {
      await roadmapTabBtn.first().click();
    }

    const progressText = await page.locator("text=总进度").count();
    expect(progressText).toBe(1);

    const masteredCount = await page.locator("text=1/5").count();
    expect(masteredCount).toBeGreaterThanOrEqual(1);
  });

  test("new session should create empty roadmap (nodes generated after diagnosis)", async ({
    request,
  }) => {
    test.setTimeout(60000);

    const createResponse = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "Python 装饰器" },
    });
    expect(createResponse.ok()).toBeTruthy();

    const { session } = await createResponse.json();
    expect(session.status).toBe("active");
    expect(session.roadmap).toBeDefined();
    expect(session.roadmap.nodes.length).toBe(0);
  });
});
