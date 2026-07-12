import { describe, expect, it } from "vitest";

import { createApp } from "../src/app/create-app";
import { createContainer } from "../src/app/container";
import { getAppConfig } from "../src/shared/config/app-config";
import { InMemoryCustomerRepository } from "../src/infrastructure/db/in-memory-customer-repository";
import { InMemoryInvoiceRepository } from "../src/infrastructure/db/in-memory-invoice-repository";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";
import type { PaymentProvider } from "../src/domain/payments/payment-provider";

function createTestApp(input?: {
  enableDevTools?: boolean;
  adminPassword?: string;
}) {
  const paymentRepository = new InMemoryPaymentRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const invoiceRepository = new InMemoryInvoiceRepository();
  const container = createContainer(undefined, {
    paymentRepository,
    customerRepository,
    invoiceRepository
  });
  const config = getAppConfig({
    APP_ENV: "development",
    ADMIN_PASSWORD: input?.adminPassword ?? "test-admin-password",
    SESSION_SECRET: "test-session-secret",
    GROW_MODE: "mock",
    INVOICE_MODE: "mock",
    ENABLE_DEV_TOOLS: String(input?.enableDevTools ?? true),
    DEFAULT_PAYMENT_PROVIDER: "mock-grow"
  });

  const app = createApp({
    getContainer: () => container,
    getConfig: () => config
  });

  return { app, container, config };
}

async function login(app: ReturnType<typeof createApp>, password: string) {
  const formData = new URLSearchParams({
    password,
    next: "/"
  });

  const response = await app.request("/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: formData.toString()
  });
  const cookie = response.headers.get("set-cookie");

  return { response, cookie };
}

describe("app routes", () => {
  it("redirects unauthenticated admin page requests to /login", async () => {
    const { app } = createTestApp();

    const response = await app.request("/");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("fails login with wrong password and succeeds with correct password", async () => {
    const { app } = createTestApp();

    const wrong = await login(app, "wrong-password");
    expect(wrong.response.status).toBe(302);
    expect(wrong.response.headers.get("location")).toContain("error=");

    const correct = await login(app, "test-admin-password");
    expect(correct.response.status).toBe(302);
    expect(correct.response.headers.get("set-cookie")).toContain(
      "nimrodi_admin_session="
    );
  });

  it("allows authenticated admin access and logout clears the session", async () => {
    const { app } = createTestApp();
    const session = await login(app, "test-admin-password");

    const dashboard = await app.request("/", {
      headers: {
        cookie: session.cookie ?? ""
      }
    });
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain("דשבורד");

    const logout = await app.request("/logout", {
      method: "POST",
      headers: {
        cookie: session.cookie ?? ""
      }
    });
    expect(logout.status).toBe(302);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects protected APIs without auth and leaves real webhook public", async () => {
    const { app } = createTestApp();

    const paymentsResponse = await app.request("/api/payments");
    expect(paymentsResponse.status).toBe(401);

    const growWebhookResponse = await app.request("/api/grow/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    expect(growWebhookResponse.status).toBe(400);
    expect(await growWebhookResponse.text()).toContain("לא נמצא מזהה פנימי");
  });

  it("requires auth for CSV export and returns CSV when authenticated", async () => {
    const { app } = createTestApp();

    const unauthenticated = await app.request("/admin/payments/export.csv");
    expect(unauthenticated.status).toBe(302);

    const session = await login(app, "test-admin-password");
    await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח CSV",
        customer_phone: "0501111222",
        customer_email: "csv@example.com",
        amount_shekel: "98.76",
        description: "יצוא CSV"
      })
    });

    const response = await app.request("/admin/payments/export.csv", {
      headers: {
        cookie: session.cookie ?? ""
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const csvText = await response.text();
    // Hebrew headers
    expect(csvText).toContain("לקוח");
    expect(csvText).toContain("סכום");
    expect(csvText).toContain("סטטוס תשלום");
    // No English headers
    expect(csvText).not.toContain("customer_name");
    expect(csvText).not.toContain("customer_email");
  });

  it("creates a mocked payment through authenticated APIs and lists it", async () => {
    const { app } = createTestApp();
    const session = await login(app, "test-admin-password");

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח בדיקה",
        customer_phone: "0500000000",
        customer_email: "test@example.com",
        amount_shekel: "1250.00",
        description: "שכר טרחה"
      })
    });

    expect(createResponse.status).toBe(201);
    const createdPayload = (await createResponse.json()) as {
      payment: { id: string; amountAgorot: number; status: string };
    };
    expect(createdPayload.payment.amountAgorot).toBe(125000);
    expect(createdPayload.payment.status).toBe("payment_created");

    const listResponse = await app.request("/api/payments?limit=20&offset=0", {
      headers: {
        cookie: session.cookie ?? ""
      }
    });
    expect(listResponse.status).toBe(200);

    const detailResponse = await app.request(
      `/api/payments/${createdPayload.payment.id}`,
      {
        headers: {
          cookie: session.cookie ?? ""
        }
      }
    );
    expect(detailResponse.status).toBe(200);
    const detailPayload = (await detailResponse.json()) as {
      payment: { id: string; paymentUrl: string };
    };
    expect(detailPayload.payment.paymentUrl).toContain("/dev/mock-grow/pay/");
  });

  it("processes mock webhooks only when dev tools are enabled", async () => {
    const { app } = createTestApp({ enableDevTools: true });
    const session = await login(app, "test-admin-password");

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח webhook",
        customer_phone: "0500000002",
        customer_email: "webhook-route@example.com",
        amount_shekel: "750.00",
        description: "בדיקת route"
      })
    });
    const createPayload = (await createResponse.json()) as {
      payment: {
        id: string;
        providerPaymentId: string;
        providerTransactionId: string;
      };
    };

    const webhookPayload = {
      event_id: "evt_route_paid",
      event_type: "payment.paid",
      provider: "mock_grow",
      provider_payment_id: createPayload.payment.providerPaymentId,
      provider_transaction_id: createPayload.payment.providerTransactionId,
      status: "paid",
      amount_agorot: 75000,
      currency: "ILS",
      occurred_at: "2026-07-09T10:00:00.000Z"
    };

    const webhookResponse = await app.request("/api/mock-grow/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify(webhookPayload)
    });
    expect(webhookResponse.status).toBe(200);
    const webhookResult = (await webhookResponse.json()) as {
      outcome: string;
      payment: { status: string; invoiceId: string | null };
    };
    expect(webhookResult.outcome).toBe("processed");
    expect(webhookResult.payment.status).toBe("paid");
    expect(webhookResult.payment.invoiceId).toBeTruthy();

    const duplicateResponse = await app.request("/api/mock-grow/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify(webhookPayload)
    });
    expect(duplicateResponse.status).toBe(200);
    expect(await duplicateResponse.text()).toContain('"duplicate":true');
  });

  it("blocks dev-only endpoints and hides simulator UI when dev tools are disabled", async () => {
    const { app } = createTestApp({ enableDevTools: false });
    const session = await login(app, "test-admin-password");

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח ללא סימולטור",
        customer_phone: "0500000003",
        customer_email: "no-devtools@example.com",
        amount_shekel: "500.00",
        description: "בדיקת מסך"
      })
    });
    const createPayload = (await createResponse.json()) as {
      payment: { id: string; providerPaymentId: string };
    };

    const detailPage = await app.request(
      `/admin/payments/${createPayload.payment.id}`,
      {
        headers: {
          cookie: session.cookie ?? ""
        }
      }
    );
    expect(detailPage.status).toBe(200);
    const detailHtml = await detailPage.text();
    expect(detailHtml).not.toContain("סימולטור פיתוח — לא GROW אמיתי");

    const blockedWebhook = await app.request("/api/mock-grow/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({})
    });
    expect(blockedWebhook.status).toBe(404);

    const blockedMockPage = await app.request(
      `/dev/mock-grow/pay/${createPayload.payment.providerPaymentId}`,
      {
        headers: {
          cookie: session.cookie ?? ""
        }
      }
    );
    expect(blockedMockPage.status).toBe(404);
  });

  it("shows system status details on the settings page", async () => {
    const { app } = createTestApp();
    const session = await login(app, "test-admin-password");

    const response = await app.request("/admin/settings/client-requirements", {
      headers: {
        cookie: session.cookie ?? ""
      }
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("סטטוס מערכת");
    expect(html).toContain("דמו");
    expect(html).toContain("תצורת הסביבה");
  });

  it("returns a clear safe health error when sandbox config is incomplete", async () => {
    const app = createApp({
      getConfig: () =>
        getAppConfig({
          APP_ENV: "staging",
          ADMIN_PASSWORD: "staging-password",
          SESSION_SECRET: "staging-secret",
          GROW_MODE: "sandbox",
          INVOICE_MODE: "mock",
          ENABLE_DEV_TOOLS: "false"
        })
    });

    const response = await app.request("/health");
    expect(response.status).toBe(500);
    const payload = (await response.json()) as {
      status: string;
      error: string;
    };
    expect(payload.status).toBe("config_error");
    expect(payload.error).toContain("GROW_USER_ID");
    expect(payload.error).not.toContain("secret");
  });

  it("returns safe readiness output in mock mode", async () => {
    const { app } = createTestApp();

    const response = await app.request("/ready");
    const payload = await response.text();
    expect(response.status).toBe(503);
    expect(payload).toContain('"status":"not_ready"');
    expect(payload).toContain('"db":"missing_binding"');
  });

  it("does not expose secrets in readiness config errors", async () => {
    const app = createApp({
      getConfig: () =>
        getAppConfig({
          APP_ENV: "staging",
          ADMIN_PASSWORD: "staging-password",
          SESSION_SECRET: "staging-secret",
          GROW_MODE: "sandbox",
          GROW_API_KEY: "very-secret-key",
          INVOICE_MODE: "mock",
          ENABLE_DEV_TOOLS: "false"
        })
    });

    const response = await app.request("/ready");
    expect(response.status).toBe(500);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("GROW_USER_ID");
    expect(payload.error).not.toContain("very-secret-key");
  });

  it("does not expose mock simulator buttons in production configuration", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const customerRepository = new InMemoryCustomerRepository();
    const invoiceRepository = new InMemoryInvoiceRepository();
    const container = createContainer(undefined, {
      paymentRepository,
      customerRepository,
      invoiceRepository
    });
    const config = getAppConfig({
      APP_ENV: "production",
      ADMIN_PASSWORD: "prod-password",
      SESSION_SECRET: "prod-secret",
      GROW_MODE: "mock",
      ALLOW_MOCK_GROW_IN_PRODUCTION: "true",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "false"
    });
    const app = createApp({
      getContainer: () => container,
      getConfig: () => config
    });

    const session = await login(app, "prod-password");
    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח production",
        customer_phone: "0500000011",
        customer_email: "prod@example.com",
        amount_shekel: "210.00",
        description: "בדיקת production"
      })
    });
    const createPayload = (await createResponse.json()) as {
      payment: { id: string };
    };

    const detailPage = await app.request(
      `/admin/payments/${createPayload.payment.id}`,
      {
        headers: {
          cookie: session.cookie ?? ""
        }
      }
    );
    const html = await detailPage.text();
    expect(html).not.toContain("סימולטור פיתוח — לא GROW אמיתי");
    expect(html).not.toContain("כלי פיתוח פעילים");
  });

  it("returns safe 404 responses for unknown routes", async () => {
    const { app } = createTestApp();
    const session = await login(app, "test-admin-password");

    const htmlResponse = await app.request("/missing-page", {
      headers: {
        cookie: session.cookie ?? ""
      }
    });
    expect(htmlResponse.status).toBe(404);
    expect(await htmlResponse.text()).toContain("העמוד לא נמצא");

    const apiResponse = await app.request("/api/missing");
    expect(apiResponse.status).toBe(404);
    expect(await apiResponse.text()).toContain("הנתיב המבוקש לא נמצא");
  });

  it("returns safe JSON API errors", async () => {
    const { app } = createTestApp();
    const session = await login(app, "test-admin-password");

    const response = await app.request("/api/payments/does-not-exist", {
      headers: {
        cookie: session.cookie ?? ""
      }
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("בקשת התשלום לא נמצאה");
  });

  it("renders protected admin pages and mock pages after login", async () => {
    const { app } = createTestApp({ enableDevTools: true });
    const session = await login(app, "test-admin-password");

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח אדמין",
        customer_phone: "0500000001",
        customer_email: "admin@example.com",
        amount_shekel: "500.00",
        description: "בדיקת מסך"
      })
    });
    const createPayload = (await createResponse.json()) as {
      payment: { id: string };
    };

    const dashboard = await app.request("/", {
      headers: { cookie: session.cookie ?? "" }
    });
    expect(dashboard.status).toBe(200);
    const dashboardHtml = await dashboard.text();
    expect(dashboardHtml).toContain("סביבת הדגמה");
    expect(dashboardHtml).toContain("/admin/payments?status=payment_created");

    const newPaymentPage = await app.request("/admin/payments/new", {
      headers: { cookie: session.cookie ?? "" }
    });
    expect(newPaymentPage.status).toBe(200);

    const paymentsPage = await app.request("/admin/payments", {
      headers: { cookie: session.cookie ?? "" }
    });
    expect(paymentsPage.status).toBe(200);
    const paymentsHtml = await paymentsPage.text();
    expect(paymentsHtml).toContain("עסקאות");
    expect(paymentsHtml).toContain("<th>מס'</th>");

    const detailPage = await app.request(
      `/admin/payments/${createPayload.payment.id}`,
      {
        headers: { cookie: session.cookie ?? "" }
      }
    );
    const detailHtml = await detailPage.text();
    expect(detailHtml).toContain("WhatsApp");
    expect(detailHtml).toContain("התנתקות");
    expect(detailHtml).toContain("סימולציית תשלום (דמו)");

    const paymentApiResponse = await app.request(
      `/api/payments/${createPayload.payment.id}`,
      {
        headers: { cookie: session.cookie ?? "" }
      }
    );
    const paymentApiPayload = (await paymentApiResponse.json()) as {
      payment: { providerPaymentId: string };
    };

    const mockPayPage = await app.request(
      `/dev/mock-grow/pay/${paymentApiPayload.payment.providerPaymentId}`,
      {
        headers: { cookie: session.cookie ?? "" }
      }
    );
    expect(mockPayPage.status).toBe(200);
    expect(await mockPayPage.text()).toContain("עמוד תשלום דמו");
  });

  it("creates a mock invoice manually only for paid payments and serves mock invoice page", async () => {
    const { app, container } = createTestApp({ enableDevTools: true });
    const session = await login(app, "test-admin-password");

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח חשבונית",
        customer_phone: "0500000099",
        customer_email: "invoice-route@example.com",
        amount_shekel: "640.00",
        description: "בדיקת מסמך ידני"
      })
    });
    const createPayload = (await createResponse.json()) as {
      payment: { id: string };
    };

    const rejected = await app.request(
      `/api/payments/${createPayload.payment.id}/invoice/mock`,
      {
        method: "POST",
        headers: {
          cookie: session.cookie ?? ""
        }
      }
    );
    expect(rejected.status).toBe(422);

    await container.paymentRepository.updateStatus({
      paymentId: createPayload.payment.id,
      status: "paid",
      updatedAt: "2026-07-09T12:00:00.000Z",
      paidAt: "2026-07-09T12:00:00.000Z"
    });

    const createInvoiceResponse = await app.request(
      `/api/payments/${createPayload.payment.id}/invoice/mock`,
      {
        method: "POST",
        headers: {
          cookie: session.cookie ?? ""
        }
      }
    );
    expect(createInvoiceResponse.status).toBe(201);
    const invoicePayload = (await createInvoiceResponse.json()) as {
      outcome: string;
      invoice: { providerInvoiceId: string };
    };
    expect(invoicePayload.outcome).toBe("created");

    const mockInvoicePage = await app.request(
      `/dev/mock-invoices/${invoicePayload.invoice.providerInvoiceId}`,
      {
        headers: {
          cookie: session.cookie ?? ""
        }
      }
    );
    expect(mockInvoicePage.status).toBe(200);
    expect(await mockInvoicePage.text()).toContain("מסמך דמו");
  });

  it("processes the public make-grow webhook without login and does not create a mock invoice", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const customerRepository = new InMemoryCustomerRepository();
    const invoiceRepository = new InMemoryInvoiceRepository();
    const paymentProvider: PaymentProvider = {
      providerKey: "make-grow",
      async createPaymentRequest(input) {
        return {
          provider: "make-grow",
          providerPaymentId: `make_process_${input.internalPaymentId}`,
          providerTransactionId: `make_tx_${input.internalPaymentId}`,
          paymentUrl: "https://grow.example/pay/mock",
          status: "payment_created",
          rawReference: { mode: "make-grow" }
        };
      },
      async getPaymentStatus(providerPaymentId) {
        return {
          provider: "make-grow",
          providerPaymentId,
          providerTransactionId: null,
          status: "payment_created"
        };
      }
    };
    const container = createContainer(
      undefined,
      {
        paymentRepository,
        customerRepository,
        invoiceRepository,
        paymentProvider
      },
      getAppConfig({
        APP_ENV: "staging",
        ADMIN_PASSWORD: "staging-password",
        SESSION_SECRET: "staging-secret",
        DEFAULT_PAYMENT_PROVIDER: "make-grow",
        GROW_MODE: "mock",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "false",
        MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL:
          "https://hook.make.com/create-payment",
        PUBLIC_BASE_URL: "https://payments.example"
      })
    );
    const app = createApp({
      getContainer: () => container,
      getConfig: () =>
        getAppConfig({
          APP_ENV: "staging",
          ADMIN_PASSWORD: "staging-password",
          SESSION_SECRET: "staging-secret",
          DEFAULT_PAYMENT_PROVIDER: "make-grow",
          GROW_MODE: "mock",
          INVOICE_MODE: "mock",
          ENABLE_DEV_TOOLS: "false",
          MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL:
            "https://hook.make.com/create-payment",
          PUBLIC_BASE_URL: "https://payments.example"
        })
    });

    const session = await login(app, "staging-password");
    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח Make route",
        amount_shekel: "1250.00",
        description: "תשלום דרך Make"
      })
    });
    const createPayload = (await createResponse.json()) as {
      payment: {
        id: string;
        providerPaymentId: string;
        providerTransactionId: string;
      };
    };

    const webhookResponse = await app.request("/api/grow/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        payment_id: createPayload.payment.id,
        paymentLinkProcessId: createPayload.payment.providerPaymentId,
        transactionId: createPayload.payment.providerTransactionId,
        status: "success",
        amount: "1250.00",
        currency: "ILS"
      })
    });

    expect(webhookResponse.status).toBe(200);
    const webhookPayload = (await webhookResponse.json()) as {
      payment: { status: string; invoiceId: string | null };
      message: string;
    };
    expect(webhookPayload.payment.status).toBe("paid");
    expect(webhookPayload.payment.invoiceId).toBeNull();
    expect(webhookPayload.message).not.toContain("קבלה הופקה");
  });

  it("filters payments by customer name and renders matching rows", async () => {
    const { app } = createTestApp({ enableDevTools: false });
    const session = await login(app, "test-admin-password");

    // Create two payments with distinct customer names
    await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "ישראל ישראלי",
        amount_shekel: "100.00",
        description: "תשלום ישראל"
      })
    });
    await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "מתן ספדה",
        amount_shekel: "200.00",
        description: "תשלום מתן"
      })
    });

    // Filter by partial Hebrew customer name
    const filteredPage = await app.request("/admin/payments?customer=ישראל", {
      headers: { cookie: session.cookie ?? "" }
    });
    expect(filteredPage.status).toBe(200);
    const html = await filteredPage.text();

    // Should contain the matching customer row
    expect(html).toContain("ישראל ישראלי");
    // Should NOT contain the other customer in the results area
    const resultsStart = html.indexOf('id="payments-results"');
    const resultsEnd = html.indexOf("</table>", resultsStart);
    const resultsHtml = html.slice(resultsStart, resultsEnd);
    expect(resultsHtml).toContain("ישראל ישראלי");
    expect(resultsHtml).not.toContain("מתן ספדה");

    // Customer chip should render
    expect(html).toContain("לקוח: ישראל");

    // Removing customer chip should go to URL without customer param
    const chipRemoveMatch = html.match(/לקוח:.*?href="([^"]+)"/s);
    expect(chipRemoveMatch).not.toBeNull();
    expect(chipRemoveMatch![1]).not.toContain("customer=");
  });

  it("customer filter preserves status and sort filters in page links", async () => {
    const { app } = createTestApp({ enableDevTools: false });
    const session = await login(app, "test-admin-password");

    const filteredPage = await app.request(
      "/admin/payments?customer=ישראל&status=paid&sort=amount_agorot&dir=asc",
      { headers: { cookie: session.cookie ?? "" } }
    );
    expect(filteredPage.status).toBe(200);
    const html = await filteredPage.text();
    // Sort links and chips must contain customer param (URL-encoded Hebrew)
    expect(html).toContain("customer=");
    expect(html).toContain("status=paid");
  });

  it("shows filter-aware empty state when active filter returns no rows", async () => {
    const { app } = createTestApp();
    const session = await login(app, "test-admin-password");

    // Create one payment so the repo is not globally empty
    await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie ?? ""
      },
      body: JSON.stringify({
        customer_name: "לקוח קיים",
        amount_shekel: "100.00",
        description: "תשלום"
      })
    });

    // Filter by a customer name that doesn't exist → filter-aware empty state
    const noMatchPage = await app.request(
      "/admin/payments?customer=לאנמצאמעולם",
      { headers: { cookie: session.cookie ?? "" } }
    );
    const noMatchHtml = await noMatchPage.text();
    expect(noMatchHtml).toContain("לא נמצאו עסקאות התואמות לסינון.");
    expect(noMatchHtml).not.toContain("עדיין לא נוצרו בקשות תשלום.");

    // No filter and no payments → global empty state
    const { app: emptyApp } = createTestApp();
    const emptySession = await login(emptyApp, "test-admin-password");
    const emptyPage = await emptyApp.request("/admin/payments", {
      headers: { cookie: emptySession.cookie ?? "" }
    });
    const emptyHtml = await emptyPage.text();
    expect(emptyHtml).toContain("עדיין לא נוצרו בקשות תשלום.");
    expect(emptyHtml).not.toContain("לא נמצאו עסקאות התואמות לסינון.");
  });
});
