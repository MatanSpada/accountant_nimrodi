import type { Hono } from "hono";

import type { AppConfig } from "../shared/config/app-config";

export function registerReadyRoutes(
  app: Hono<{ Bindings: Env }>,
  getConfig: (env?: Env) => AppConfig
) {
  app.get("/ready", async (c) => {
    getConfig(c.env);

    if (!c.env?.DB) {
      return c.json(
        {
          status: "not_ready",
          phase: "6/8",
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
      phase: "6/8",
      checks: {
        config: "ok",
        db: "ok"
      }
    });
  });
}
