import type { Hono } from "hono";

import type { AppContainer } from "../app/container";
import type { AppConfig } from "../shared/config/app-config";
import {
  type DashboardMetrics,
  renderClientRequirementsPage,
  renderDashboardPage,
  renderNewPaymentPage,
  renderPaymentDetailsPage,
  renderPaymentsListPage
} from "../ui/admin/admin-page";
import { AppError } from "../shared/errors/app-error";

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function registerAdminRoutes(
  app: Hono<{ Bindings: Env }>,
  getContainer: (env?: Env) => AppContainer,
  getConfig: (env?: Env) => AppConfig
) {
  app.get("/", async (c) => {
    const container = getContainer(c.env);
    const appConfig = getConfig(c.env);
    const recentPayments = await container.paymentService.listPayments({
      limit: 8
    });
    const allPayments = await container.paymentService.listPayments({
      limit: 1000,
      offset: 0
    });
    const invoices = await Promise.all(
      recentPayments.items.map((payment) =>
        container.invoiceService.getInvoiceByPaymentId(payment.id)
      )
    );
    const pendingStatuses = new Set<
      DashboardMetrics["statusBreakdown"][number]["status"]
    >(["draft", "payment_created", "pending"]);
    const statusBreakdownItems = [
      { status: "paid", label: "שולמו" },
      { status: "pending", label: "ממתינים" },
      { status: "payment_created", label: "קישור נוצר" },
      { status: "failed", label: "נכשלו" },
      { status: "cancelled", label: "בוטלו" },
      { status: "expired", label: "פג תוקף" },
      { status: "draft", label: "טיוטות" }
    ] as const satisfies ReadonlyArray<{
      status: DashboardMetrics["statusBreakdown"][number]["status"];
      label: string;
    }>;
    const statusBreakdown: DashboardMetrics["statusBreakdown"] =
      statusBreakdownItems.map((item) => ({
        ...item,
        count: allPayments.items.filter(
          (payment) => payment.status === item.status
        ).length
      }));
    const metrics: DashboardMetrics = {
      totalRequests: allPayments.items.length,
      paidCount: allPayments.items.filter(
        (payment) => payment.status === "paid"
      ).length,
      pendingCount: allPayments.items.filter((payment) =>
        pendingStatuses.has(payment.status)
      ).length,
      paidAmountAgorot: allPayments.items
        .filter((payment) => payment.status === "paid")
        .reduce((total, payment) => total + payment.amountAgorot, 0),
      pendingAmountAgorot: allPayments.items
        .filter((payment) => pendingStatuses.has(payment.status))
        .reduce((total, payment) => total + payment.amountAgorot, 0),
      statusBreakdown
    };

    return c.html(
      renderDashboardPage({
        appConfig,
        payments: recentPayments.items.map((payment, index) => ({
          payment,
          invoice: invoices[index] ?? null
        })),
        metrics
      })
    );
  });

  app.get("/admin/payments/new", (c) => {
    const appConfig = getConfig(c.env);
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
        appConfig,
        errorMessage,
        formValues
      })
    );
  });

  app.get("/admin/payments", async (c) => {
    const container = getContainer(c.env);
    const appConfig = getConfig(c.env);
    const limit = Number(c.req.query("limit") ?? "20");
    const offset = Number(c.req.query("offset") ?? "0");
    const payments = await container.paymentService.listPayments({
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0
    });
    const invoices = await Promise.all(
      payments.items.map((payment) =>
        container.invoiceService.getInvoiceByPaymentId(payment.id)
      )
    );
    const invoiceByPaymentId = Object.fromEntries(
      payments.items.map((payment, index) => [
        payment.id,
        invoices[index] ?? null
      ])
    );

    return c.html(
      renderPaymentsListPage({ appConfig, payments, invoiceByPaymentId })
    );
  });

  app.get("/admin/payments/export.csv", async (c) => {
    const container = getContainer(c.env);
    const payments = await container.paymentService.listPayments({
      limit: 1000,
      offset: 0
    });
    const invoiceRows = await Promise.all(
      payments.items.map((payment) =>
        container.invoiceService.getInvoiceByPaymentId(payment.id)
      )
    );
    const rows = payments.items.map((payment, index) => {
      const invoice = invoiceRows[index];
      return [
        payment.createdAt,
        payment.customerName,
        payment.customerPhone ?? "",
        payment.customerEmail ?? "",
        (payment.amountAgorot / 100).toFixed(2),
        payment.currency,
        payment.status,
        invoice?.status ?? "",
        payment.provider,
        payment.providerPaymentId ?? "",
        payment.providerTransactionId ?? "",
        invoice?.invoiceNumber ?? "",
        invoice?.invoiceUrl ?? ""
      ]
        .map((value) => escapeCsvValue(value))
        .join(",");
    });

    const csv = [
      [
        "created_at",
        "customer_name",
        "customer_phone",
        "customer_email",
        "amount",
        "currency",
        "status",
        "invoice_status",
        "provider",
        "provider_payment_id",
        "provider_transaction_id",
        "invoice_number",
        "invoice_url"
      ].join(","),
      ...rows
    ].join("\n");

    c.header("content-type", "text/csv; charset=utf-8");
    c.header(
      "content-disposition",
      'attachment; filename="nimrodi-payments-export.csv"'
    );

    return c.body(csv);
  });

  app.get("/admin/payments/:id", async (c) => {
    const container = getContainer(c.env);
    const appConfig = getConfig(c.env);
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
    const invoice = await container.invoiceService.getInvoiceByPaymentId(
      payment.id
    );

    return c.html(
      renderPaymentDetailsPage({
        appConfig,
        payment,
        invoice,
        webhooks,
        simulatorMessage: c.req.query("simulator_message") ?? null,
        simulatorOutcome: c.req.query("simulator_outcome") ?? null,
        invoiceMessage: c.req.query("invoice_message") ?? null,
        invoiceOutcome: c.req.query("invoice_outcome") ?? null
      })
    );
  });

  app.get("/admin/settings/client-requirements", (c) => {
    return c.html(
      renderClientRequirementsPage({
        appConfig: getConfig(c.env)
      })
    );
  });
}
