import type { MiddlewareHandler } from "hono";

import { AppError } from "../shared/errors/app-error";
import { logger } from "../shared/logger/logger";

export const errorMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    logger.error("request_failed", {
      path: c.req.path,
      error: error instanceof Error ? error.message : "unknown_error"
    });

    if (error instanceof AppError) {
      return c.json({ error: error.message }, error.statusCode);
    }

    return c.json({ error: "אירעה שגיאה לא צפויה." }, 500);
  }
};
