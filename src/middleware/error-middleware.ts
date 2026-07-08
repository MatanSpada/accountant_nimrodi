import type { MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

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

    if (
      error instanceof AppError ||
      (typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        "message" in error)
    ) {
      const statusCode =
        typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? ((error as { statusCode: number })
              .statusCode as ContentfulStatusCode)
          : 400;
      const message =
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "אירעה שגיאה בבקשה.";

      return c.json({ error: message }, statusCode);
    }

    return c.json({ error: "אירעה שגיאה לא צפויה." }, 500);
  }
};
