import type { Hono } from "hono";

import type { AppConfig } from "../shared/config/app-config";
import { AppError } from "../shared/errors/app-error";

export function registerHealthRoutes(
  app: Hono<{ Bindings: Env }>,
  getConfig: (env?: Env) => AppConfig
) {
  app.get("/health", (c) => {
    try {
      return c.json({
        status: "ok",
        service: "accountant-nimrodi-payments",
        phase: "8/8",
        providerMode: getConfig(c.env).growMode
      });
    } catch (error) {
      return c.json(
        {
          status: "config_error",
          service: "accountant-nimrodi-payments",
          phase: "8/8",
          error:
            error instanceof AppError ? error.message : "אירעה שגיאת תצורה."
        },
        500
      );
    }
  });
}
