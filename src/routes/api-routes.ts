import type { Hono } from "hono";

import { createContainer } from "../app/container";
import { AppError } from "../shared/errors/app-error";

const container = createContainer();

export function registerApiRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/payments", async (c) => {
    const payments = await container.paymentService.listPayments();
    return c.json({ payments });
  });

  app.post("/api/payments", async (c) => {
    const body = await c.req.json().catch(() => {
      throw new AppError("גוף הבקשה חייב להיות JSON תקין.", 400);
    });

    const payment = await container.paymentService.createPaymentRequest(body);
    return c.json({ payment }, 201);
  });
}
