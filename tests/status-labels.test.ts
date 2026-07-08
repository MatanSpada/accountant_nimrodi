import { describe, expect, it } from "vitest";

import { PAYMENT_STATUS_LABELS } from "../src/ui/admin/status-labels";

describe("payment status labels", () => {
  it("maps internal statuses to hebrew UI labels", () => {
    expect(PAYMENT_STATUS_LABELS).toEqual({
      draft: "טיוטה",
      payment_created: "קישור נוצר",
      pending: "ממתין לתשלום",
      paid: "שולם",
      failed: "נכשל",
      cancelled: "בוטל",
      expired: "פג תוקף"
    });
  });
});
