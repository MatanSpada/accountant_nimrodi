import { describe, expect, it } from "vitest";

import {
  buildWhatsAppLink,
  buildWhatsAppMessage
} from "../src/ui/admin/whatsapp-helper";

describe("whatsapp helper", () => {
  it("builds a short professional hebrew message", () => {
    const message = buildWhatsAppMessage({
      customerName: "יעל",
      description: "שכר טרחה",
      amountAgorot: 125000,
      paymentUrl: "https://mock-payments.local/pay/123"
    });

    expect(message).toContain("שלום יעל");
    expect(message).toContain("שכר טרחה");
    expect(message).toContain("1,250.00 ₪");
    expect(message).toContain("https://mock-payments.local/pay/123");
  });

  it("builds a wa.me link with normalized phone", () => {
    const link = buildWhatsAppLink({
      customerName: "יעל",
      customerPhone: "050-123-4567",
      description: "שכר טרחה",
      amountAgorot: 125000,
      paymentUrl: "https://mock-payments.local/pay/123"
    });

    expect(link).toContain("https://wa.me/972501234567?text=");
    expect(decodeURIComponent(link as string)).toContain("שלום יעל");
  });

  it("returns null when required fields are missing", () => {
    expect(
      buildWhatsAppLink({
        customerName: "יעל",
        customerPhone: null,
        description: "שכר טרחה",
        amountAgorot: 125000,
        paymentUrl: "https://mock-payments.local/pay/123"
      })
    ).toBeNull();
  });
});
