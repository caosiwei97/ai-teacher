# 迭代 040：Next.js → Vite + React 迁移

> 优先级：P1 | 分类：优化 | 状态：⬜ 待开始

## 背景

项目定位本地使用，Next.js 的核心能力（SSR/SSG/Server Components）均未使用。当前 49 个组件全部是 `"use client"`，实质是用最重的框架写 SPA。Vite + React 更轻量、构建更快、心智负担更低。

## 目标

- 将 `apps/web` 从 Next.js 15 迁移为 Vite + React
- 保持所有现有功能不变
- 减少构建时间和开发启动时间
- 去除不必要的框架抽象层

## 迁移范围

### 需要替换的

| Next.js 功能 | 替代方案 |
|---|---|
| App Router 文件路由 | react-router v7 |
| API Route (`/api/chat`) | Vite `server.proxy` 转发到 Hono 38422 |
| `next/image` | 原生 `<img>` 或 `vite-imagetools` |
| `next/font` | 直接引入字体文件 |
| `"use client"` 声明 | 全部删除（Vite 默认客户端渲染） |

### 不受影响的

- 所有 React 组件逻辑（TSX 代码不变）
- Tailwind CSS 4 配置
- hooks（`use-chat-stream.ts` 等）
- 与 Server/Worker 的 SSE 通信

## 实施步骤

1. 初始化 Vite + React + TypeScript 项目结构
2. 迁移 Tailwind CSS 4 配置
3. 配置 react-router 路由（约 5 个页面）
4. 配置 Vite dev server proxy（转发 `/api/*` 到 Hono）
5. 迁移组件（去掉 `"use client"`，替换 Next.js 专有 import）
6. 迁移静态资源
7. 验证所有功能正常
8. E2E 全量回归

## 风险

- 迁移过程中可能遗漏 Next.js 隐式行为（如自动 prefetch）
- E2E 测试中的路由匹配可能需要调整

## 验收标准

- 所有页面功能与迁移前一致
- E2E 全量通过
- `pnpm dev:web` 启动时间 < 3s（目前 Next.js ~8s）
- 构建产物体积减小
