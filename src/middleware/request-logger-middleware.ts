import type { MiddlewareHandler } from "hono";

import { logger } from "../shared/logger/logger";

export const requestLoggerMiddleware: MiddlewareHandler = async (c, next) => {
  const startedAt = Date.now();
  await next();

  logger.info("request_completed", {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - startedAt
  });
};
