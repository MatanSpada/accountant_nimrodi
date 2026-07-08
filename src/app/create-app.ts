import { Hono } from "hono";

import { registerAdminRoutes } from "../routes/admin-routes";
import { registerApiRoutes } from "../routes/api-routes";
import { registerHealthRoutes } from "../routes/health-routes";
import { errorMiddleware } from "../middleware/error-middleware";
import { requestLoggerMiddleware } from "../middleware/request-logger-middleware";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", requestLoggerMiddleware);
  app.use("*", errorMiddleware);

  registerHealthRoutes(app);
  registerAdminRoutes(app);
  registerApiRoutes(app);

  return app;
}
