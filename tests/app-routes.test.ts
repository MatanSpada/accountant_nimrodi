import { describe, expect, it } from "vitest";

import { createApp } from "../src/app/create-app";
import { createContainer } from "../src/app/container";
import { getAppConfig } from "../src/shared/config/app-config";
import { InMemoryCustomerRepository } from "../src/infrastructure/db/in-memory-customer-repository";
import { InMemoryInvoiceRepository } from "../src/infrastructure/db/in-memory-invoice-repository";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";

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
    expect(await dashboard.text()).toContain("מערכת תשלומים — נמרודי ושות׳");

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
    expect(growWebhookResponse.status).toBe(501);
    expect(await growWebhookResponse.text()).toContain(
      "verified sandbox/production payload examples"
    );
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

  it("shows Grow mode and missing client requirements on the settings page", async () => {
    const { app } = createTestApp();
    const session = await login(app, "test-admin-password");

    const response = await app.request("/admin/settings/client-requirements", {
      headers: {
        cookie: session.cookie ?? ""
      }
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("GROW_MODE");
    expect(html).toContain("mock");
    expect(html).toContain("payloads מאומתים של webhook מ-sandbox");
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
    expect(await dashboard.text()).toContain("מצב פיתוח");

    const newPaymentPage = await app.request("/admin/payments/new", {
      headers: { cookie: session.cookie ?? "" }
    });
    expect(newPaymentPage.status).toBe(200);

    const paymentsPage = await app.request("/admin/payments", {
      headers: { cookie: session.cookie ?? "" }
    });
    expect(paymentsPage.status).toBe(200);
    expect(await paymentsPage.text()).toContain("רשימת עסקאות");

    const detailPage = await app.request(
      `/admin/payments/${createPayload.payment.id}`,
      {
        headers: { cookie: session.cookie ?? "" }
      }
    );
    const detailHtml = await detailPage.text();
    expect(detailHtml).toContain("פתיחת WhatsApp");
    expect(detailHtml).toContain("התנתקות");
    expect(detailHtml).toContain("קבלה / מסמך");

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
    expect(await mockPayPage.text()).toContain(
      "עמוד תשלום מדומה — לצורכי פיתוח בלבד"
    );
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
    expect(await mockInvoicePage.text()).toContain(
      "מסמך מדומה — לצורכי פיתוח בלבד"
    );
  });
});
