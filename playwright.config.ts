import { defineConfig } from "@playwright/test";
import path from "path";
import fs from "fs";
import { homedir } from "os";

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher_test";

// E2E 测试使用独立端口，避免与开发环境冲突
const TEST_WEB_PORT = 48421;
const TEST_SERVER_PORT = 48422;
const TEST_WORKER_PORT = 48423;
const TEST_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const pnpmLocations = [
  path.join(homedir(), ".volta", "bin"),
  path.join(homedir(), ".bun", "bin"),
  path.join(homedir(), ".local", "bin"),
  path.join(homedir(), "Library", "pnpm"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

let pnpmPath = "";
for (const dir of pnpmLocations) {
  const candidate = path.join(dir, "pnpm");
  if (fs.existsSync(candidate)) {
    pnpmPath = dir;
    break;
  }
}

// 找到 pnpm 后注入 PATH，找不到则依赖系统默认
const PATH_INJECT = pnpmPath ? `export PATH='${pnpmPath}':$PATH && ` : "";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${TEST_WEB_PORT}`,
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
      command: `${PATH_INJECT}MOCK_LLM=true DATABASE_URL=${TEST_DATABASE_URL} SERVER_PORT=${TEST_SERVER_PORT} LLM_ENCRYPTION_KEY=${TEST_ENCRYPTION_KEY} pnpm --filter @ai-teacher/server dev`,
      port: TEST_SERVER_PORT,
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: `${PATH_INJECT}MOCK_LLM=true DATABASE_URL=${TEST_DATABASE_URL} WORKER_PORT=${TEST_WORKER_PORT} SERVER_PORT=${TEST_SERVER_PORT} pnpm --filter @ai-teacher/worker dev`,
      port: TEST_WORKER_PORT,
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: `${PATH_INJECT}API_SERVER_URL=http://localhost:${TEST_SERVER_PORT} NEXT_PUBLIC_API_URL=http://localhost:${TEST_SERVER_PORT} PORT=${TEST_WEB_PORT} pnpm --filter @ai-teacher/web dev:test`,
      port: TEST_WEB_PORT,
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
