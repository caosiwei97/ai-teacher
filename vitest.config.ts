import { defineConfig } from 'vitest/config'

// 根目录单配置，覆盖 apps/worker + apps/server + packages/shared
// @ai-teacher/* 通过 pnpm workspace 链接解析到源码（main 指向 src），无需 alias
export default defineConfig({
  test: {
    include: ['apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: [
        'apps/worker/src/**/*.ts',
        'apps/server/src/**/*.ts',
        'packages/shared/src/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts', '**/types.ts'],
    },
  },
})
