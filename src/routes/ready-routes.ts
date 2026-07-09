import type { Hono } from "hono";

import type { AppConfig } from "../shared/config/app-config";
import { AppError } from "../shared/errors/app-error";

export function registerReadyRoutes(
  app: Hono<{ Bindings: Env }>,
  getConfig: (env?: Env) => AppConfig
) {
  app.get("/ready", async (c) => {
    try {
      getConfig(c.env);
    } catch (error) {
      return c.json(
        {
          status: "config_error",
          phase: "8/8",
          checks: {
            config: "failed",
            db: "unknown"
          },
          error:
            error instanceof AppError ? error.message : "אירעה שגיאת תצורה."
        },
        500
      );
    }

    if (!c.env?.DB) {
      return c.json(
        {
          status: "not_ready",
          phase: "8/8",
          checks: {
            config: "ok",
            db: "missing_binding"
          }
        },
        503
      );
    }

    await c.env.DB.prepare("SELECT 1 AS ok").first();

    return c.json({
      status: "ready",
      phase: "8/8",
      checks: {
        config: "ok",
        db: "ok"
      }
    });
  });
}
