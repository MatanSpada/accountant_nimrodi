import type { Hono } from "hono";

import { createContainer } from "../app/container";
import { AppError } from "../shared/errors/app-error";

export function registerApiRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/payments", async (c) => {
    const container = createContainer(c.env);
    const limit = Number(c.req.query("limit") ?? "20");
    const offset = Number(c.req.query("offset") ?? "0");
    const payments = await container.paymentService.listPayments({
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0
    });

    return c.json(payments);
  });

  app.get("/api/payments/:id", async (c) => {
    const container = createContainer(c.env);
    const payment = await container.paymentService.getPaymentById(
      c.req.param("id")
    );

    if (!payment) {
      throw new AppError("בקשת התשלום לא נמצאה.", 404);
    }

    return c.json({ payment });
  });

  app.post("/api/payments", async (c) => {
    const container = createContainer(c.env);
    const body = await c.req.json().catch(() => {
      throw new AppError("גוף הבקשה חייב להיות JSON תקין.", 400);
    });

    const payment = await container.paymentService.createPaymentRequest(body);
    return c.json({ payment }, 201);
  });
}
