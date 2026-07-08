import { describe, expect, it } from "vitest";

import { AppError } from "../src/shared/errors/app-error";
import {
  assertValidAmountAgorot,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  validateCreatePaymentDraftInput
} from "../src/domain/payments/payment-validation";

describe("payment validation", () => {
  it("accepts integer agorot amounts", () => {
    expect(() => assertValidAmountAgorot(12345)).not.toThrow();
  });

  it("rejects floating point money", () => {
    expect(() => assertValidAmountAgorot(123.45)).toThrow(AppError);
  });

  it("normalizes israeli phone numbers pragmatically", () => {
    expect(normalizeCustomerPhone("+972-50-123-4567")).toBe("0501234567");
    expect(normalizeCustomerPhone("050 123 4567")).toBe("0501234567");
  });

  it("rejects invalid phone numbers", () => {
    expect(() => normalizeCustomerPhone("123")).toThrow(AppError);
  });

  it("normalizes and validates email", () => {
    expect(normalizeCustomerEmail(" CLIENT@EXAMPLE.COM ")).toBe(
      "client@example.com"
    );
    expect(() => normalizeCustomerEmail("bad-email")).toThrow(AppError);
  });

  it("normalizes and validates request input", () => {
    const result = validateCreatePaymentDraftInput({
      customerName: "  יעל ישראלי  ",
      customerPhone: " 0501234567 ",
      customerEmail: " CLIENT@EXAMPLE.COM ",
      amountAgorot: 9900,
      currency: "ils",
      description: "  שכר טרחה  ",
      externalCrmDealId: " deal-123 "
    });

    expect(result).toEqual({
      customerName: "יעל ישראלי",
      customerPhone: "0501234567",
      customerEmail: "client@example.com",
      amountAgorot: 9900,
      currency: "ILS",
      description: "שכר טרחה",
      externalCrmDealId: "deal-123"
    });
  });
});
