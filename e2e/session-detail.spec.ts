import { test, expect } from "@playwright/test";

const USER_ID = "seed-user-ai-teacher";
const SEED_SESSION_ID = "seed-session-react-hooks";

test.describe("Session Detail API", () => {
  test("should return full session with roadmap and messages", async ({ request }) => {
    const response = await request.get(`/api/sessions/${SEED_SESSION_ID}`);
    expect(response.ok()).toBeTruthy();

    const { session } = await response.json();
    expect(session.id).toBe(SEED_SESSION_ID);
    expect(session.topic).toBeTruthy();
    expect(session.status).toBe("active");

    expect(session.roadmap).toBeDefined();
    expect(session.roadmap.nodes).toHaveLength(5);
    expect(session.roadmap.nodes[0].title).toBeTruthy();

    expect(session.messages).toBeDefined();
    expect(session.messages.length).toBeGreaterThanOrEqual(1);
  });

  test("should include user with profile", async ({ request }) => {
    const response = await request.get(`/api/sessions/${SEED_SESSION_ID}`);
    const { session } = await response.json();

    expect(session.user).toBeDefined();
    expect(session.user.id).toBe(USER_ID);
  });

  test("should return 404 for non-existent session", async ({ request }) => {
    const response = await request.get("/api/sessions/non-existent-session-id");
    expect(response.status()).toBe(404);
  });

  test("roadmap nodes should have correct status distribution", async ({ request }) => {
    const response = await request.get(`/api/sessions/${SEED_SESSION_ID}`);
    const { session } = await response.json();
    const nodes = session.roadmap.nodes;

    const mastered = nodes.filter((n: { status: string }) => n.status === "mastered");
    const inProgress = nodes.filter((n: { status: string }) => n.status === "in_progress");
    const notStarted = nodes.filter((n: { status: string }) => n.status === "not_started");

    expect(mastered.length).toBe(1);
    expect(inProgress.length).toBe(1);
    expect(notStarted.length).toBe(3);
  });
});
