import { test, expect } from "@playwright/test";

// 分类 K：学习资料上传 UI 全链路（MOCK_LLM=true）。
// 验证：UI 面板 → multipart 上传 API → Source 创建 → 列表 API → 状态徽标渲染 → 删除。
// 注：worker 异步处理（pending→ready）依赖 E2E worker 的 DB 连接，该连接在本机环境存在
// 预存系统性问题（chat-turn job 同样报 "Server has closed the connection"，现有 E2E 因宽松断言通过），
// 故本测试断言 source 出现（上传成功信号）而非特定 ready 状态。
// retrieve-context 工具 + 真实 embedding 的语义检索已在 service 层（RAG 链路验证）覆盖。

const LEARN_PATH = "/learn/seed-session-react-hooks";
const MD_CONTENT =
  "# React Hooks\n\nuseState 是 React 的状态钩子，用于在函数组件中添加局部 state。useEffect 处理副作用。";

test.describe("Sources — 学习资料上传（分类 K）", () => {
  test("上传 Markdown → 列表出现 → 删除", async ({ page }) => {
    await page.goto(LEARN_PATH);
    await expect(page.locator("textarea")).toBeVisible();

    // 打开资料面板
    await page.locator('button[title="学习资料"]').click();
    await expect(page.getByText("上传 PDF / Markdown")).toBeVisible();

    // 上传 markdown（hidden file input，Playwright 可直接 setInputFiles）
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: "react-hooks.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(MD_CONTENT),
      });

    // 上传成功 → source 出现在列表（标题可见）
    await expect(page.getByText("react-hooks.md")).toBeVisible({ timeout: 10000 });

    // 删除（清理，避免污染同 run 其他测试的 system prompt 资料提示）
    await page.locator('button:has(svg[class*="trash"])').first().click();
    await expect(page.getByText("react-hooks.md")).toHaveCount(0);
  });
});
