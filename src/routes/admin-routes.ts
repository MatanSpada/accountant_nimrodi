import type { Hono } from "hono";

import type { AppContainer } from "../app/container";
import {
  renderClientRequirementsPage,
  renderDashboardPage,
  renderNewPaymentPage,
  renderPaymentDetailsPage,
  renderPaymentsListPage
} from "../ui/admin/admin-page";
import { AppError } from "../shared/errors/app-error";

export function registerAdminRoutes(
  app: Hono<{ Bindings: Env }>,
  getContainer: (env?: Env) => AppContainer
) {
  app.get("/", async (c) => {
    const container = getContainer(c.env);
    const payments = await container.paymentService.listPayments({ limit: 20 });
    return c.html(renderDashboardPage({ payments: payments.items }));
  });

  app.get("/admin/payments/new", (c) => {
    const errorMessage = c.req.query("error") ?? null;
    const formValues = {
      customer_name: c.req.query("customer_name") ?? "",
      customer_phone: c.req.query("customer_phone") ?? "",
      customer_email: c.req.query("customer_email") ?? "",
      amount_shekel: c.req.query("amount_shekel") ?? "",
      description: c.req.query("description") ?? ""
    };

    return c.html(
      renderNewPaymentPage({
        errorMessage,
        formValues
      })
    );
  });

  app.get("/admin/payments", async (c) => {
    const container = getContainer(c.env);
    const limit = Number(c.req.query("limit") ?? "20");
    const offset = Number(c.req.query("offset") ?? "0");
    const payments = await container.paymentService.listPayments({
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0
    });

    return c.html(renderPaymentsListPage({ payments }));
  });

  app.get("/admin/payments/:id", async (c) => {
    const container = getContainer(c.env);
    const payment = await container.paymentService.getPaymentById(
      c.req.param("id")
    );

    if (!payment) {
      throw new AppError("בקשת התשלום לא נמצאה.", 404);
    }

    const webhooks = await container.paymentWebhookService.listPaymentWebhooks(
      payment.id,
      10
    );

    return c.html(
      renderPaymentDetailsPage({
        payment,
        webhooks,
        simulatorMessage: c.req.query("simulator_message") ?? null,
        simulatorOutcome: c.req.query("simulator_outcome") ?? null
      })
    );
  });

  app.get("/admin/settings/client-requirements", (c) => {
    return c.html(renderClientRequirementsPage());
  });
}
