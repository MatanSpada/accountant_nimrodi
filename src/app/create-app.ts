import { createContainer, type AppContainer } from "./container";
import { Hono } from "hono";

import { registerAdminRoutes } from "../routes/admin-routes";
import { registerApiRoutes } from "../routes/api-routes";
import { registerAuthRoutes } from "../routes/auth-routes";
import { registerHealthRoutes } from "../routes/health-routes";
import { registerReadyRoutes } from "../routes/ready-routes";
import { registerWebhookRoutes } from "../routes/webhook-routes";
import { getAppConfig, type AppConfig } from "../shared/config/app-config";
import { accessControlMiddleware } from "../middleware/access-control-middleware";
import {
  errorMiddleware,
  handleAppError
} from "../middleware/error-middleware";
import { requestLoggerMiddleware } from "../middleware/request-logger-middleware";
import { renderStatusPage } from "../ui/admin/admin-page";

export function createApp(options?: {
  getContainer?: (env?: Env) => AppContainer;
  getConfig?: (env?: Env) => AppConfig;
}) {
  const app = new Hono<{ Bindings: Env }>();
  const getConfig = options?.getConfig ?? ((env?: Env) => getAppConfig(env));
  const getContainer =
    options?.getContainer ??
    ((env?: Env) => createContainer(env, undefined, getConfig(env)));

  app.use("*", requestLoggerMiddleware);
  app.use("*", errorMiddleware);
  app.onError((error, c) => handleAppError(error, c));

  registerHealthRoutes(app, getConfig);
  registerReadyRoutes(app, getConfig);
  registerAuthRoutes(app, getConfig);
  app.use("*", accessControlMiddleware(getConfig));
  registerAdminRoutes(app, getContainer, getConfig);
  registerApiRoutes(app, getContainer);
  registerWebhookRoutes(app, getContainer, getConfig);
  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "הנתיב המבוקש לא נמצא." }, 404);
    }

    try {
      return c.html(
        renderStatusPage({
          appConfig: getConfig(c.env),
          title: "404",
          headline: "העמוד לא נמצא",
          message: "הנתיב שביקשת לא קיים במערכת או הוסר.",
          statusCode: 404
        }),
        404
      );
    } catch {
      return c.html(
        '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8" /><title>404</title></head><body><h1>העמוד לא נמצא</h1><p>הנתיב שביקשת לא קיים במערכת או הוסר.</p></body></html>',
        404
      );
    }
  });

  return app;
}
