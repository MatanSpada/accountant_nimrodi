import type { Hono } from "hono";

import { createContainer } from "../app/container";
import { renderAdminPage } from "../ui/admin/admin-page";

const container = createContainer();

export function registerAdminRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/", async (c) => {
    const payments = await container.paymentService.listPayments();
    return c.html(renderAdminPage({ payments }));
  });
}
