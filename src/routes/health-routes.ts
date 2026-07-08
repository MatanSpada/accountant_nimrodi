import type { Hono } from "hono";

export function registerHealthRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "accountant-nimrodi-payments",
      phase: "2/8",
      providerMode: "mocked"
    })
  );
}
