import { describe, expect, it } from "vitest";

import { AppError } from "../src/shared/errors/app-error";
import {
  assertAgorotAmount,
  validateCreatePaymentRequestInput
} from "../src/domain/payments/payment-validation";

describe("payment validation", () => {
  it("accepts integer agorot amounts", () => {
    expect(() => assertAgorotAmount(12345)).not.toThrow();
  });

  it("rejects floating point money", () => {
    expect(() => assertAgorotAmount(123.45)).toThrow(AppError);
  });

  it("normalizes and validates request input", () => {
    const result = validateCreatePaymentRequestInput({
      customerName: "  יעל ישראלי  ",
      customerPhone: " 0501234567 ",
      customerEmail: " CLIENT@EXAMPLE.COM ",
      amountAgorot: 9900,
      currency: "ils",
      description: "  שכר טרחה  "
    });

    expect(result).toEqual({
      customerName: "יעל ישראלי",
      customerPhone: "0501234567",
      customerEmail: "client@example.com",
      amountAgorot: 9900,
      currency: "ILS",
      description: "שכר טרחה"
    });
  });
});
