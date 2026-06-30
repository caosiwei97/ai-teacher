import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "./layouts/app-layout";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // 默认路由重定向到 /learn（无 id 引导态）
      { path: "/", element: <Navigate to="/learn" replace /> },
      {
        // /learn 无 id = 引导态；/learn/:sessionId = 聊天态（同一组件内部判断）
        path: "/learn",
        lazy: () => import("./pages/learn"),
      },
      {
        path: "/learn/:sessionId",
        lazy: () => import("./pages/learn"),
      },
      {
        path: "/settings",
        lazy: () => import("./pages/settings"),
      },
    ],
  },
]);
