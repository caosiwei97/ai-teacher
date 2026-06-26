// 迭代 042 计算性传感器 —— monorepo ESLint flat config
// 自定义规则 no-default-export 强制 AGENTS.md §4 命名导出规范
// config 文件（eslint/vite/postcss 等）豁免：框架要求 default export
import tseslint from "typescript-eslint";
import noDefaultExport from "./scripts/eslint-rules/no-default-export.mjs";

// 本地自定义规则作为内联插件注册
const localPlugin = {
  meta: { name: "ai-teacher-local" },
  rules: { "no-default-export": noDefaultExport },
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.config.{js,mjs,cjs,ts}",
      "packages/db/prisma/migrations/**",
      // ESLint 规则模块本身必须 default export，不纳入 lint
      "scripts/eslint-rules/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { "ai-teacher": localPlugin },
    rules: {
      // 计算性传感器：禁止 default export（AGENTS.md §4）
      "ai-teacher/no-default-export": "error",
      // 类型导入隔离（迭代 042 可优化方向）
      "@typescript-eslint/consistent-type-imports": "warn",
      // any 治理非 042 范围（非 AGENTS.md 规则），降级为告警避免阻塞
      "@typescript-eslint/no-explicit-any": "warn",
      // 未使用变量：下划线前缀豁免
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Playwright globalSetup/globalTeardown 必须 default export，豁免
  {
    files: ["e2e/global-setup.ts", "e2e/global-teardown.ts"],
    rules: {
      "ai-teacher/no-default-export": "off",
    },
  },
  // Web：JSX
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
);
