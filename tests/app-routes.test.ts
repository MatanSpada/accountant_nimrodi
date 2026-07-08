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
    expect(detailPayload.payment.paymentUrl).toContain(
      "https://mock-payments.local/pay/"
    );
  });

  it("renders admin pages for dashboard, create, list, details and settings", async () => {
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

    const settingsPage = await app.request(
      "/admin/settings/client-requirements"
    );
    expect(settingsPage.status).toBe(200);
    expect(await settingsPage.text()).toContain("GROW userId");
  });
});
