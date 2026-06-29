import { test, expect } from "@playwright/test";

// 分类 R — 复习模式（迭代 051③，spec §3 / §9.2 Phase 2）
// 覆盖：今日到期清单 + 提交结果更新记忆强度（API）+ 抽认卡翻面/自评（UI）+ 单点/≥2 交错两场景

const REACT_HOOKS_SESSION = "seed-session-react-hooks"; // 1 mastered（单点场景）
const REVIEW_MULTI_SESSION = "seed-session-review-multi"; // 2 mastered（≥2 交错场景）

test.describe("Review — 复习模式（分类 R）", () => {
  test("多节点到期清单：≥2 mastered 返回多项（交错场景）", async ({ request }) => {
    const res = await request.get(
      `/api/sessions/${REVIEW_MULTI_SESSION}/review/due`,
    );
    expect(res.ok()).toBeTruthy();
    const { dueNodes } = await res.json();
    expect(dueNodes.length).toBe(2);
    expect(dueNodes.every((n: { isOverdue: boolean }) => n.isOverdue)).toBeTruthy();
  });

  test("提交复习结果更新记忆强度 + PATCH 切复习模式 + 薄弱点汇总", async ({ request }) => {
    const nodeId = "seed-node-review-a";

    // PATCH 切复习模式（spec §5.1 模式切换是状态变化）
    const patchRes = await request.patch(`/api/sessions/${REVIEW_MULTI_SESSION}`, {
      data: { activeMode: "review" },
    });
    expect(patchRes.ok()).toBeTruthy();
    const { session: patched } = await patchRes.json();
    expect(patched.activeMode).toBe("review");

    // 第一次答错：1.0 → 0.7，间隔重置 1d，趋势衰退
    const r1 = await request.post(
      `/api/sessions/${REVIEW_MULTI_SESSION}/review/result`,
      { data: { nodeId, correct: false } },
    );
    expect(r1.ok()).toBeTruthy();
    const { result: r1out } = await r1.json();
    expect(r1out.trend).toBe("衰退");
    expect(r1out.reviewInterval).toBe(1);
    expect(r1out.memoryStrength).toBeCloseTo(0.7, 6);

    // 答错后该节点下次复习时间为明天 → 不在今日到期清单
    const due1 = await request.get(
      `/api/sessions/${REVIEW_MULTI_SESSION}/review/due`,
    );
    const { dueNodes: due1nodes } = await due1.json();
    expect(due1nodes.find((n: { id: string }) => n.id === nodeId)).toBeUndefined();

    // 第二次答错：0.7 → 0.4，进入薄弱点（< 0.6）
    await request.post(`/api/sessions/${REVIEW_MULTI_SESSION}/review/result`, {
      data: { nodeId, correct: false },
    });
    const sum = await request.get(
      `/api/sessions/${REVIEW_MULTI_SESSION}/review/summary`,
    );
    const { summary } = await sum.json();
    expect(summary.weakNodes.map((n: { id: string }) => n.id)).toContain(nodeId);
  });

  test("抽认卡翻面 + 自评答错 → POST 更新记忆强度（UI，mock LLM）", async ({ page, request }) => {
    test.setTimeout(60000);
    await page.goto(`/learn/${REACT_HOOKS_SESSION}`);
    await page.waitForSelector("textarea");

    // 点顶部复习 Tab（mastered≥1 解锁）→ 触发复习模式（spec §5.1 顶部 Tab 替代右栏 tab）
    await page.getByTestId("mode-tabs").locator("button", { hasText: "复习" }).click();
    // 右栏复习清单可见（到期 1 项，单点场景）
    await expect(page.locator("text=理解 useState")).toBeVisible({ timeout: 10000 });

    // 等"开始复习吧"触发的 mock chat 回复完，避免 loading 吞 [render-flashcard] 提交
    await page.waitForTimeout(3000);

    // mock 触发抽认卡：输入 [render-flashcard]（chat 空闲态，避免 loading 吞提交）
    const textarea = page.locator("textarea");
    await textarea.fill("[render-flashcard]");
    await page.locator("form").evaluate((el) =>
      el.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );

    // 抽认卡正面渲染
    await expect(page.locator("text=复习抽认卡")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("button:has-text('翻面看答案')")).toBeVisible();

    // 翻面 → 答案可见
    await page.locator("button:has-text('翻面看答案')").click();
    await expect(page.locator("text=答案")).toBeVisible();

    // 拦截 POST /review/result，点"答错了"
    const resultPromise = page.waitForResponse(
      (r) => r.url().includes("/review/result") && r.request().method() === "POST",
    );
    await page.locator("button:has-text('答错了')").click();
    const resultRes = await resultPromise;
    expect(resultRes.ok()).toBeTruthy();
    const body = resultRes.request().postDataJSON();
    expect(body).toEqual({ nodeId: "seed-node-use-state", correct: false });
    const { result } = await resultRes.json();
    expect(result.trend).toBe("衰退");

    // 恢复 activeMode=learning，避免污染共享会话（learn/mastery 也用此会话，串行下确保恢复后跑）
    await request.patch(`/api/sessions/${REACT_HOOKS_SESSION}`, {
      data: { activeMode: "learning" },
    });
  });
});
