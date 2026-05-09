import type { MiddlewareHandler } from "hono";

export const auth: MiddlewareHandler = async (c, next) => {
  const userId = c.req.header("x-user-id");
  c.set("userId", userId);
  await next();
};
