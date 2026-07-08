import { describe, expect, it } from "vitest";

import {
  PAYMENT_STATUSES,
  canTransitionPaymentStatus,
  isFinalPaymentStatus,
  isPaymentStatus
} from "../src/domain/payments/payment-status";

describe("payment statuses", () => {
  it("contains the supported values", () => {
    expect(PAYMENT_STATUSES).toEqual([
      "draft",
      "payment_created",
      "pending",
      "paid",
      "failed",
      "cancelled",
      "expired"
    ]);
  });

  it("validates allowed status strings", () => {
    expect(isPaymentStatus("paid")).toBe(true);
    expect(isPaymentStatus("unknown")).toBe(false);
  });

  it("marks final statuses correctly", () => {
    expect(isFinalPaymentStatus("paid")).toBe(true);
    expect(isFinalPaymentStatus("failed")).toBe(true);
    expect(isFinalPaymentStatus("cancelled")).toBe(true);
    expect(isFinalPaymentStatus("expired")).toBe(true);
    expect(isFinalPaymentStatus("pending")).toBe(false);
  });

  it("enforces pragmatic transition rules", () => {
    expect(canTransitionPaymentStatus("draft", "payment_created")).toBe(true);
    expect(canTransitionPaymentStatus("payment_created", "pending")).toBe(true);
    expect(canTransitionPaymentStatus("pending", "paid")).toBe(true);
    expect(canTransitionPaymentStatus("paid", "pending")).toBe(false);
    expect(canTransitionPaymentStatus("cancelled", "paid")).toBe(false);
  });
});
