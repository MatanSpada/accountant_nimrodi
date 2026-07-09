import type { Context, MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { AppError } from "../shared/errors/app-error";
import { logger } from "../shared/logger/logger";
import { getAppConfig } from "../shared/config/app-config";
import { renderStatusPage } from "../ui/admin/admin-page";

function wantsJson(path: string) {
  return path.startsWith("/api/");
}

function renderPlainHtmlError(headline: string, message: string) {
  return `<!DOCTYPE html>
  <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${headline}</title>
    </head>
    <body style="font-family: sans-serif; padding: 32px; background: #f7f4ef; color: #1f2a37;">
      <h1>${headline}</h1>
      <p>${message}</p>
    </body>
  </html>`;
}

export function handleAppError(error: unknown, c: Context<{ Bindings: Env }>) {
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
        ? ((error as { statusCode: number }).statusCode as ContentfulStatusCode)
        : 400;
    const message =
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "אירעה שגיאה בבקשה.";

    if (!wantsJson(c.req.path)) {
      try {
        const appConfig = getAppConfig(c.env);
        return c.html(
          renderStatusPage({
            appConfig,
            title: "שגיאה",
            headline: statusCode === 404 ? "העמוד לא נמצא" : "אירעה שגיאה",
            message,
            statusCode
          }),
          statusCode
        );
      } catch {
        return c.html(
          renderPlainHtmlError(
            statusCode === 404 ? "העמוד לא נמצא" : "אירעה שגיאה",
            message
          ),
          statusCode
        );
      }
    }

    return c.json({ error: message }, statusCode);
  }

  if (!wantsJson(c.req.path)) {
    try {
      const appConfig = getAppConfig(c.env);
      return c.html(
        renderStatusPage({
          appConfig,
          title: "שגיאה פנימית",
          headline: "אירעה שגיאה פנימית",
          message: "אירעה שגיאה לא צפויה. אפשר לנסות שוב או לחזור ללוח הבקרה.",
          statusCode: 500
        }),
        500
      );
    } catch {
      return c.html(
        renderPlainHtmlError(
          "אירעה שגיאה פנימית",
          "אירעה שגיאה לא צפויה. אפשר לנסות שוב מאוחר יותר."
        ),
        500
      );
    }
  }

  return c.json({ error: "אירעה שגיאה לא צפויה." }, 500);
}

export const errorMiddleware: MiddlewareHandler = async (_c, next) => {
  await next();
};
