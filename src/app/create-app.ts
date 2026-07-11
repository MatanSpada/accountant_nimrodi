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
import { InMemoryPaymentRepository } from "../infrastructure/db/in-memory-payment-repository";
import { DEMO_PAYMENTS } from "../infrastructure/db/demo-seed";

export function createApp(options?: {
  getContainer?: (env?: Env) => AppContainer;
  getConfig?: (env?: Env) => AppConfig;
}) {
  const app = new Hono<{ Bindings: Env }>();
  const getConfig = options?.getConfig ?? ((env?: Env) => getAppConfig(env));

  // Singleton container for in-memory (local dev / no DB) mode so that
  // data created during one request is visible in the next.
  let _devContainer: AppContainer | null = null;

  const getContainer =
    options?.getContainer ??
    ((env?: Env) => {
      if (env?.DB) return createContainer(env, undefined, getConfig(env));
      if (!_devContainer) {
        _devContainer = createContainer(
          env,
          { paymentRepository: new InMemoryPaymentRepository(DEMO_PAYMENTS) },
          getConfig(env)
        );
      }
      return _devContainer;
    });

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
