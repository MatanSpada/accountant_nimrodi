import { describe, expect, it } from "vitest";

import { AppError } from "../src/shared/errors/app-error";
import {
  assertValidAmountAgorot,
  convertAmountShekelToAgorotForTesting,
  normalizeCreatePaymentApiInput,
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

  it("converts amount_shekel to amount_agorot", () => {
    expect(convertAmountShekelToAgorotForTesting("1250.55")).toBe(125055);
    expect(convertAmountShekelToAgorotForTesting(99.9)).toBe(9990);
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

  it("normalizes API payloads from snake_case fields", () => {
    const result = normalizeCreatePaymentApiInput({
      customer_name: "לקוח",
      customer_phone: "0501234567",
      customer_email: "demo@example.com",
      amount_shekel: "420.50",
      currency: "ils",
      description: "בדיקה"
    });

    expect(result).toEqual({
      customerName: "לקוח",
      customerPhone: "0501234567",
      customerEmail: "demo@example.com",
      amountAgorot: 42050,
      currency: "ils",
      description: "בדיקה",
      externalCrmDealId: null
    });
  });
});
