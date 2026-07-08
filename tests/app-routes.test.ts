import { describe, expect, it } from "vitest";

import { createApp } from "../src/app/create-app";
import { createContainer } from "../src/app/container";
import { InMemoryCustomerRepository } from "../src/infrastructure/db/in-memory-customer-repository";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";

function createTestApp() {
  const paymentRepository = new InMemoryPaymentRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const container = createContainer(undefined, {
    paymentRepository,
    customerRepository
  });

  const app = createApp({
    getContainer: () => container
  });

  return { app, container };
}

describe("app routes", () => {
  it("creates a mocked payment via POST /api/payments and lists it", async () => {
    const { app } = createTestApp();

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json"
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

    const listResponse = await app.request("/api/payments?limit=20&offset=0");
    expect(listResponse.status).toBe(200);
    const listPayload = (await listResponse.json()) as {
      items: Array<{ id: string }>;
    };
    expect(listPayload.items).toHaveLength(1);
    expect(listPayload.items[0]?.id).toBe(createdPayload.payment.id);

    const detailResponse = await app.request(
      `/api/payments/${createdPayload.payment.id}`
    );
    expect(detailResponse.status).toBe(200);
    const detailPayload = (await detailResponse.json()) as {
      payment: { id: string; paymentUrl: string };
    };
    expect(detailPayload.payment.id).toBe(createdPayload.payment.id);
    expect(detailPayload.payment.paymentUrl).toContain("/dev/mock-grow/pay/");
  });

  it("processes mock webhooks and rejects the real grow endpoint for now", async () => {
    const { app } = createTestApp();

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json"
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
        "content-type": "application/json"
      },
      body: JSON.stringify(webhookPayload)
    });
    expect(webhookResponse.status).toBe(200);
    const webhookResult = (await webhookResponse.json()) as {
      outcome: string;
      payment: { status: string };
    };
    expect(webhookResult.outcome).toBe("processed");
    expect(webhookResult.payment.status).toBe("paid");

    const duplicateResponse = await app.request("/api/mock-grow/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(webhookPayload)
    });
    expect(duplicateResponse.status).toBe(200);
    const duplicateResult = (await duplicateResponse.json()) as {
      outcome: string;
      duplicate: boolean;
    };
    expect(duplicateResult.outcome).toBe("duplicate");
    expect(duplicateResult.duplicate).toBe(true);

    const growWebhookResponse = await app.request("/api/grow/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    expect(growWebhookResponse.status).toBe(501);
    expect(await growWebhookResponse.text()).toContain(
      "Use /api/mock-grow/webhook in development."
    );
  });

  it("renders admin pages for dashboard, create, list, details, settings and mock pay page", async () => {
    const { app } = createTestApp();

    const createResponse = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json"
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

    const dashboard = await app.request("/");
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain("מערכת תשלומים — נמרודי ושות׳");

    const newPaymentPage = await app.request("/admin/payments/new");
    expect(newPaymentPage.status).toBe(200);
    expect(await newPaymentPage.text()).toContain("יצירת בקשת תשלום");

    const paymentsPage = await app.request("/admin/payments");
    expect(paymentsPage.status).toBe(200);
    expect(await paymentsPage.text()).toContain("רשימת עסקאות");

    const detailPage = await app.request(
      `/admin/payments/${createPayload.payment.id}`
    );
    expect(detailPage.status).toBe(200);
    const detailHtml = await detailPage.text();
    expect(detailHtml).toContain("פתיחת WhatsApp");
    expect(detailHtml).toContain("העתקת קישור");
    expect(detailHtml).toContain("סימולטור פיתוח — לא GROW אמיתי");
    expect(detailHtml).toContain("/api/mock-grow/webhook");

    const paymentApiResponse = await app.request(
      `/api/payments/${createPayload.payment.id}`
    );
    const paymentApiPayload = (await paymentApiResponse.json()) as {
      payment: { providerPaymentId: string };
    };

    const mockPayPage = await app.request(
      `/dev/mock-grow/pay/${paymentApiPayload.payment.providerPaymentId}`
    );
    expect(mockPayPage.status).toBe(200);
    expect(await mockPayPage.text()).toContain(
      "עמוד תשלום מדומה — לצורכי פיתוח בלבד"
    );

    const settingsPage = await app.request(
      "/admin/settings/client-requirements"
    );
    expect(settingsPage.status).toBe(200);
    expect(await settingsPage.text()).toContain("GROW userId");
  });
});
