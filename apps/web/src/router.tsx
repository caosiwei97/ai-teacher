import { createBrowserRouter } from "react-router";
import { AppLayout } from "./layouts/app-layout";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        lazy: () => import("./pages/home"),
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
