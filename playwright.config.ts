import { defineConfig } from "@playwright/test";

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher_test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:38421",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  globalSetup: require.resolve("./e2e/global-setup"),
  globalTeardown: require.resolve("./e2e/global-teardown"),
  webServer: [
    {
      command: process.env.PNPM_PATH
        ? `MOCK_LLM=true DATABASE_URL=${TEST_DATABASE_URL} ${process.env.PNPM_PATH} --filter @ai-teacher/server dev`
        : `MOCK_LLM=true DATABASE_URL=${TEST_DATABASE_URL} pnpm dev:server`,
      port: 38422,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: process.env.PNPM_PATH
        ? `MOCK_LLM=true DATABASE_URL=${TEST_DATABASE_URL} ${process.env.PNPM_PATH} --filter @ai-teacher/worker dev`
        : `MOCK_LLM=true DATABASE_URL=${TEST_DATABASE_URL} pnpm dev:worker`,
      port: 38423,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: process.env.PNPM_PATH
        ? `${process.env.PNPM_PATH} --filter @ai-teacher/web dev`
        : "pnpm dev:web",
      port: 38421,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
