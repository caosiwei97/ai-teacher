import { test, expect } from "@playwright/test";

const USER_ID = "seed-user-ai-teacher";

test.describe("Diagnostic — Session Status", () => {
  test("should create session with diagnosing status", async ({ request }) => {
    test.setTimeout(60000);

    const response = await request.post("/api/sessions", {
      data: { userId: USER_ID, topic: "CSS Grid 布局" },
    });
    expect(response.ok()).toBeTruthy();

    const { session } = await response.json();
    expect(session.status).toBe("diagnosing");
    expect(session.roadmap.nodes.length).toBeGreaterThanOrEqual(5);
    expect(session.roadmap.nodes[0].status).toBe("in-progress");
  });
});
