import { test, expect } from "@playwright/test";

const USER_ID = "seed-user-ai-teacher";

test.describe("Diagnostic — Chat-Inline Diagnosis", () => {
  test("should create session with active status and empty roadmap", async ({ request }) => {
    test.setTimeout(60000);

    const response = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "CSS Grid 布局" },
    });
    expect(response.ok()).toBeTruthy();

    const { session } = await response.json();
    expect(session.status).toBe("active");
    expect(session.roadmap).toBeDefined();
    expect(session.roadmap.nodes.length).toBe(0);
  });

  test("should enter chat directly on learn page for new session", async ({ page, request }) => {
    test.setTimeout(60000);

    const response = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "TypeScript 泛型入门" },
    });
    const { session } = await response.json();

    await page.goto(`/learn/${session.id}`);

    await expect(
      page.locator("textarea"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("路线已生成文案与右侧路线图渲染一致", async ({ page }) => {
    test.setTimeout(90000);

    await page.goto("/learn");
    await page.locator("button", { hasText: "个人投资理财入门" }).click();

    await expect(page).toHaveURL(/\/learn\//, { timeout: 30000 });
    await expect(page.getByTestId("diagnostic-quiz-card")).toBeVisible({ timeout: 30000 });

    await page.getByTestId("diagnostic-option-d1-b").click();
    await page.getByTestId("diagnostic-option-d2-b").click();
    await page.getByTestId("diagnostic-option-d3-a").click();
    await expect(page.getByTestId("diagnostic-submit-button")).toBeEnabled();
    await page.getByTestId("diagnostic-submit-button").click();

    const preparingText = page.getByText("路线已生成，正在准备第一节互动练习…");
    await expect(preparingText).toBeVisible({ timeout: 60000 });

    const roadmapHeader = page.locator("text=学习路线");
    await expect(roadmapHeader.first()).toBeVisible({ timeout: 10000 });

    const emptyHint = page.locator("text=诊断完成后将生成学习路线");
    await expect(emptyHint).toHaveCount(0);

    const nodeContainer = page.locator("text=学习路线").locator("..");
    await expect(
      nodeContainer.locator("p").filter({ hasText: /./ }).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
