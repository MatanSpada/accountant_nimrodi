import { describe, expect, it } from "vitest";

import {
  PAYMENT_STATUSES,
  isPaymentStatus
} from "../src/domain/payments/payment-status";

describe("payment statuses", () => {
  it("contains the supported values", () => {
    expect(PAYMENT_STATUSES).toEqual([
      "draft",
      "pending",
      "paid",
      "failed",
      "cancelled"
    ]);
  });

  it("validates allowed status strings", () => {
    expect(isPaymentStatus("paid")).toBe(true);
    expect(isPaymentStatus("unknown")).toBe(false);
  });
});
