import { defineConfig } from "@playwright/test";

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
  webServer: [
    {
      command: process.env.PNPM_PATH
        ? `${process.env.PNPM_PATH} --filter @ai-teacher/server dev`
        : "pnpm dev:server",
      port: 38422,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: process.env.PNPM_PATH
        ? `${process.env.PNPM_PATH} --filter @ai-teacher/worker dev`
        : "pnpm dev:worker",
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
