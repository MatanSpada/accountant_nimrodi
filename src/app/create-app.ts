import { createContainer, type AppContainer } from "./container";
import { Hono } from "hono";

import { registerAdminRoutes } from "../routes/admin-routes";
import { registerApiRoutes } from "../routes/api-routes";
import { registerHealthRoutes } from "../routes/health-routes";
import { errorMiddleware } from "../middleware/error-middleware";
import { requestLoggerMiddleware } from "../middleware/request-logger-middleware";

export function createApp(options?: {
  getContainer?: (env?: Env) => AppContainer;
}) {
  const app = new Hono<{ Bindings: Env }>();
  const getContainer =
    options?.getContainer ?? ((env?: Env) => createContainer(env));

  app.use("*", requestLoggerMiddleware);
  app.use("*", errorMiddleware);

  registerHealthRoutes(app);
  registerAdminRoutes(app, getContainer);
  registerApiRoutes(app, getContainer);

  return app;
}
