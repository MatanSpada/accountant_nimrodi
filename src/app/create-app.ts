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
import { errorMiddleware } from "../middleware/error-middleware";
import { requestLoggerMiddleware } from "../middleware/request-logger-middleware";

export function createApp(options?: {
  getContainer?: (env?: Env) => AppContainer;
  getConfig?: (env?: Env) => AppConfig;
}) {
  const app = new Hono<{ Bindings: Env }>();
  const getContainer =
    options?.getContainer ?? ((env?: Env) => createContainer(env));
  const getConfig = options?.getConfig ?? ((env?: Env) => getAppConfig(env));

  app.use("*", requestLoggerMiddleware);
  app.use("*", errorMiddleware);

  registerHealthRoutes(app);
  registerReadyRoutes(app, getConfig);
  registerAuthRoutes(app, getConfig);
  app.use("*", accessControlMiddleware(getConfig));
  registerAdminRoutes(app, getContainer, getConfig);
  registerApiRoutes(app, getContainer);
  registerWebhookRoutes(app, getContainer, getConfig);

  return app;
}
