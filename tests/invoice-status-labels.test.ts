import { describe, expect, it } from "vitest";

import { getInvoiceStatusLabel } from "../src/ui/admin/invoice-status-labels";

describe("invoice status labels", () => {
  it("maps internal invoice statuses to Hebrew labels", () => {
    expect(getInvoiceStatusLabel("pending")).toBe("ממתין");
    expect(getInvoiceStatusLabel("created")).toBe("נוצרה");
    expect(getInvoiceStatusLabel("failed")).toBe("נכשלה");
    expect(getInvoiceStatusLabel("cancelled")).toBe("בוטלה");
  });
});
