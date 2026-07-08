import type { Hono } from "hono";

import { createContainer } from "../app/container";
import { renderAdminPage } from "../ui/admin/admin-page";

export function registerAdminRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/", async (c) => {
    const container = createContainer(c.env);
    const payments = await container.paymentService.listPayments({ limit: 20 });
    return c.html(renderAdminPage({ payments: payments.items }));
  });
}
