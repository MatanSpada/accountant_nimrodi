import type { Hono } from "hono";

import type { AppContainer } from "../app/container";
import { AppError } from "../shared/errors/app-error";
import {
  renderMockGrowPaymentPage,
  renderMockInvoicePage
} from "../ui/admin/admin-page";

export function registerWebhookRoutes(
  app: Hono<{ Bindings: Env }>,
  getContainer: (env?: Env) => AppContainer
) {
  app.post("/api/mock-grow/webhook", async (c) => {
    const container = getContainer(c.env);
    const body = await c.req.json().catch(() => {
      throw new AppError("גוף הבקשה חייב להיות JSON תקין.", 400);
    });

    const result =
      await container.paymentWebhookService.processMockGrowWebhook(body);
    const status = result.outcome === "failed" ? 422 : 200;

    return c.json(result, status);
  });

  app.post("/api/grow/webhook", (c) =>
    c.json(
      {
        error:
          "Real GROW webhook integration is not implemented yet. Use /api/mock-grow/webhook in development."
      },
      501
    )
  );

  app.get("/dev/mock-grow/pay/:providerPaymentId", async (c) => {
    const container = getContainer(c.env);
    const payment =
      await container.paymentService.getPaymentByProviderPaymentId(
        c.req.param("providerPaymentId")
      );

    if (!payment) {
      throw new AppError("בקשת התשלום המדומה לא נמצאה.", 404);
    }

    const webhooks = await container.paymentWebhookService.listPaymentWebhooks(
      payment.id,
      10
    );

    return c.html(
      renderMockGrowPaymentPage({
        payment,
        webhooks
      })
    );
  });

  app.get("/dev/mock-invoices/:invoiceId", async (c) => {
    const container = getContainer(c.env);
    const invoice =
      await container.invoiceService.getInvoiceByProviderInvoiceId(
        c.req.param("invoiceId")
      );

    if (!invoice) {
      throw new AppError("המסמך המדומה לא נמצא.", 404);
    }

    const payment = await container.paymentService.getPaymentById(
      invoice.paymentId
    );

    if (!payment) {
      throw new AppError("התשלום המשויך למסמך המדומה לא נמצא.", 404);
    }

    return c.html(renderMockInvoicePage({ invoice, payment }));
  });
}
