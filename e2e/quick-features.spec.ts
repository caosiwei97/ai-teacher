import { test, expect } from "@playwright/test";

test.describe("Quick Features — API", () => {
  test("quick question API should return stream", async ({ request }) => {
    const response = await request.post("/api/quick-question", {
      data: {
        sessionId: "seed-session-react-hooks",
        selectedText: "useState 是 React 的基础 Hook",
        question: "为什么需要 useState？",
      },
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("text/plain");
  });

  test("suggest reply API should return suggestion", async ({ request }) => {
    const response = await request.post("/api/suggest-reply", {
      data: {
        sessionId: "seed-session-react-hooks",
        currentQuestion: "请解释 useState 的工作原理",
        topic: "React Hooks",
      },
    });
    expect(response.ok()).toBeTruthy();

    const { suggestion } = await response.json();
    expect(suggestion).toBeTruthy();
    expect(typeof suggestion).toBe("string");
  });
});
