import { describe, expect, it, vi } from "vitest";

import { GrowPaymentProvider } from "../src/infrastructure/grow/grow-payment-provider";
import type { GrowProviderConfig } from "../src/shared/config/app-config";

function createGrowConfig(
  overrides?: Partial<GrowProviderConfig>
): GrowProviderConfig {
  return {
    mode: "sandbox",
    userId: "user-123",
    pageCode: "page-456",
    apiBaseUrl: "https://sandbox.grow.example/api/",
    successUrl: "https://payments.example/success",
    cancelUrl: "https://payments.example/cancel",
    notifyUrl: "https://payments.example/webhooks/grow",
    invoiceNotifyUrl: null,
    apiKey: "grow-secret-key",
    forceBankTransferOnly: false,
    bankTransferOnlyStatus: "not_requested",
    ...overrides
  };
}

describe("GrowPaymentProvider", () => {
  it("builds request from internal payment data and converts amount at the provider boundary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentUrl: "https://grow.example/pay/123",
          paymentId: "grow-pay-123",
          transactionId: "grow-tx-123"
        }),
        { status: 200 }
      )
    );
    const provider = new GrowPaymentProvider(createGrowConfig(), { fetchImpl });

    const result = await provider.createPaymentRequest({
      internalPaymentId: "pay_internal_123",
      customerName: "לקוח GROW",
      customerPhone: "0500000000",
      customerEmail: "grow@example.com",
      amountAgorot: 125000,
      currency: "ILS",
      description: "בדיקת GROW"
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://sandbox.grow.example/api/createPaymentProcess");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer grow-secret-key"
    });

    const body = JSON.parse(String((init as RequestInit).body)) as {
      amount: string;
      reference: string;
      customerName: string;
      notifyUrl: string;
    };

    expect(body.amount).toBe("1250.00");
    expect(body.reference).toBe("pay_internal_123");
    expect(body.customerName).toBe("לקוח GROW");
    expect(body.notifyUrl).toBe("https://payments.example/webhooks/grow");

    expect(result.provider).toBe("grow");
    expect(result.providerPaymentId).toBe("grow-pay-123");
    expect(result.providerTransactionId).toBe("grow-tx-123");
    expect(result.paymentUrl).toBe("https://grow.example/pay/123");
  });

  it("handles failed HTTP responses safely", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "bad request" }), { status: 401 })
      );
    const provider = new GrowPaymentProvider(createGrowConfig(), { fetchImpl });

    await expect(
      provider.createPaymentRequest({
        internalPaymentId: "pay_internal_124",
        customerName: "לקוח",
        amountAgorot: 100,
        currency: "ILS",
        description: "בדיקת שגיאה"
      })
    ).rejects.toThrow("createPaymentProcess");
  });

  it("handles invalid or missing response fields", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "grow-pay-123" }), { status: 200 })
      );
    const provider = new GrowPaymentProvider(createGrowConfig(), { fetchImpl });

    await expect(
      provider.createPaymentRequest({
        internalPaymentId: "pay_internal_125",
        customerName: "לקוח",
        amountAgorot: 100,
        currency: "ILS",
        description: "בדיקת חסר"
      })
    ).rejects.toThrow("payment URL");
  });

  it("does not leak secrets in thrown errors", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const provider = new GrowPaymentProvider(createGrowConfig(), { fetchImpl });

    try {
      await provider.createPaymentRequest({
        internalPaymentId: "pay_internal_126",
        customerName: "לקוח",
        amountAgorot: 100,
        currency: "ILS",
        description: "בדיקת סוד"
      });
      throw new Error("Expected provider.createPaymentRequest to fail");
    } catch (error) {
      expect(String(error)).toContain("createPaymentProcess");
      expect(String(error)).not.toContain("grow-secret-key");
    }
  });

  it("does not include bank-transfer-only fields when support is still unverified", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentUrl: "https://grow.example/pay/124",
          paymentId: "grow-pay-124"
        }),
        { status: 200 }
      )
    );
    const provider = new GrowPaymentProvider(
      createGrowConfig({
        forceBankTransferOnly: true,
        bankTransferOnlyStatus: "requested_unverified"
      }),
      { fetchImpl }
    );

    const result = await provider.createPaymentRequest({
      internalPaymentId: "pay_internal_127",
      customerName: "לקוח",
      amountAgorot: 100,
      currency: "ILS",
      description: "בדיקת bank transfer"
    });

    const body = JSON.parse(
      String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body)
    ) as Record<string, unknown>;

    expect(body).not.toHaveProperty("bankTransferOnly");
    expect(body).not.toHaveProperty("paymentMethod");
    expect(result.rawReference.bankTransferOnly).toContain("not sent");
  });
});
