import { test, expect } from "@playwright/test";

test.describe("Suggested Topics API", () => {
  test("should return 6 suggested topics", async ({ request }) => {
    const response = await request.get("/api/suggested-topics");
    expect(response.ok()).toBeTruthy();

    const { topics } = await response.json();
    expect(topics).toHaveLength(6);
    expect(topics[0]).toHaveProperty("id");
    expect(topics[0]).toHaveProperty("icon");
    expect(topics[0]).toHaveProperty("title");
  });

  test("each topic should have valid icon and non-empty title", async ({ request }) => {
    const response = await request.get("/api/suggested-topics");
    const { topics } = await response.json();

    for (const topic of topics) {
      expect(topic.id).toBeTruthy();
      expect(topic.title.length).toBeGreaterThan(0);
      expect(["Brain", "Heart", "TrendingUp", "MessageSquare"]).toContain(topic.icon);
    }
  });
});
