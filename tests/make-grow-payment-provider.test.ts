import { describe, expect, it, vi } from "vitest";

import { MakeGrowPaymentProvider } from "../src/infrastructure/grow/make-grow-payment-provider";
import type { MakeGrowProviderConfig } from "../src/shared/config/app-config";

function createConfig(
  overrides?: Partial<MakeGrowProviderConfig>
): MakeGrowProviderConfig {
  return {
    createPaymentLinkWebhookUrl: "https://hook.make.com/create-payment",
    createPaymentLinkSecret: "create-secret",
    approveTransactionWebhookUrl: "https://hook.make.com/approve-payment",
    approveTransactionSecret: "approve-secret",
    publicBaseUrl: "https://payments.example",
    ...overrides
  };
}

describe("MakeGrowPaymentProvider", () => {
  it("sends the expected payload to Make", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          payment_url: "https://grow.example/pay/abc",
          provider_payment_id: "grow-process-123",
          transaction_id: "grow-tx-123"
        }),
        { status: 200 }
      )
    );
    const provider = new MakeGrowPaymentProvider(createConfig(), { fetchImpl });

    const result = await provider.createPaymentRequest({
      internalPaymentId: "pay_internal_123",
      customerName: "לקוח Make",
      customerPhone: "0501234567",
      customerEmail: "make@example.com",
      amountAgorot: 125000,
      currency: "ILS",
      description: "תשלום דרך Make"
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://hook.make.com/create-payment");
    expect((init as RequestInit).headers).toMatchObject({
      "content-type": "application/json",
      "x-make-shared-secret": "create-secret"
    });

    const body = JSON.parse(String((init as RequestInit).body)) as Record<
      string,
      unknown
    >;
    expect(body.payment_id).toBe("pay_internal_123");
    expect(body.amount_agorot).toBe(125000);
    expect(body.amount_ils).toBe(1250);
    expect(body.send_method).toBe("none");
    expect(body.allowed_payment_methods).toEqual(["bank_transfer"]);
    expect(body.notify_url).toBe("https://payments.example/api/grow/webhook");

    expect(result.provider).toBe("make-grow");
    expect(result.providerPaymentId).toBe("grow-process-123");
    expect(result.providerTransactionId).toBe("grow-tx-123");
    expect(result.paymentUrl).toBe("https://grow.example/pay/abc");
  });

  it("accepts alternate response field names for payment url", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentLink: "https://grow.example/pay/alt",
          paymentLinkProcessId: "grow-process-456"
        }),
        { status: 200 }
      )
    );
    const provider = new MakeGrowPaymentProvider(createConfig(), { fetchImpl });

    const result = await provider.createPaymentRequest({
      internalPaymentId: "pay_internal_456",
      customerName: "לקוח",
      amountAgorot: 100,
      currency: "ILS",
      description: "בדיקת שדות חלופיים"
    });

    expect(result.paymentUrl).toBe("https://grow.example/pay/alt");
    expect(result.providerPaymentId).toBe("grow-process-456");
  });

  it("fails clearly when no payment url is returned", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          providerPaymentId: "grow-process-999"
        }),
        { status: 200 }
      )
    );
    const provider = new MakeGrowPaymentProvider(createConfig(), { fetchImpl });

    await expect(
      provider.createPaymentRequest({
        internalPaymentId: "pay_internal_789",
        customerName: "לקוח",
        amountAgorot: 100,
        currency: "ILS",
        description: "בדיקת כישלון"
      })
    ).rejects.toThrow("קישור תשלום");
  });

  it("calls approve transaction webhook when configured", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            payment_url: "https://grow.example/pay/abc",
            provider_payment_id: "grow-process-123"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
    const provider = new MakeGrowPaymentProvider(createConfig(), { fetchImpl });

    await provider.approveTransaction?.({
      payment: {
        id: "pay_approve_1",
        customerId: null,
        customerName: "לקוח",
        customerPhone: null,
        customerEmail: null,
        amountAgorot: 100,
        currency: "ILS",
        description: "בדיקה",
        status: "paid",
        provider: "make-grow",
        providerPaymentId: "grow-process-123",
        providerTransactionId: "grow-tx-123",
        paymentUrl: "https://grow.example/pay/abc",
        invoiceId: null,
        externalCrmDealId: null,
        createdAt: "2026-07-12T09:00:00.000Z",
        updatedAt: "2026-07-12T09:00:00.000Z",
        paidAt: "2026-07-12T09:00:00.000Z",
        cancelledAt: null,
        failedAt: null
      },
      eventType: "payment.paid",
      providerEventId: "evt_approve_1",
      rawPayload: { paymentId: "pay_approve_1" }
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://hook.make.com/approve-payment"
    );
  });
});
