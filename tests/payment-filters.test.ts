import { describe, expect, it } from "vitest";

import {
  buildChips,
  buildFilterUrl,
  buildSortUrl,
  hasActiveFilters,
  isoToDdMmYy,
  parseDdMmYy,
  parseFiltersFromQuery
} from "../src/ui/admin/payment-filters";
import { getPaymentStatusLabel } from "../src/ui/admin/status-labels";

describe("parseDdMmYy", () => {
  it("parses standard dd/mm/yy", () => {
    expect(parseDdMmYy("09/07/26")).toBe("2026-07-09");
  });

  it("parses single-digit day and month", () => {
    expect(parseDdMmYy("1/3/26")).toBe("2026-03-01");
  });

  it("returns null for missing slashes", () => {
    expect(parseDdMmYy("090726")).toBeNull();
  });

  it("returns null for four-digit year", () => {
    expect(parseDdMmYy("09/07/2026")).toBeNull();
  });

  it("returns null for month > 12", () => {
    expect(parseDdMmYy("01/13/26")).toBeNull();
  });

  it("returns null for day > 31", () => {
    expect(parseDdMmYy("32/01/26")).toBeNull();
  });

  it("returns null for day 0", () => {
    expect(parseDdMmYy("00/01/26")).toBeNull();
  });

  it("returns null for Feb 31 (calendar invalid)", () => {
    expect(parseDdMmYy("31/02/26")).toBeNull();
  });

  it("returns null for Feb 30", () => {
    expect(parseDdMmYy("30/02/26")).toBeNull();
  });

  it("accepts Feb 28 in non-leap year", () => {
    expect(parseDdMmYy("28/02/26")).toBe("2026-02-28");
  });

  it("accepts Feb 29 in leap year", () => {
    expect(parseDdMmYy("29/02/28")).toBe("2028-02-29");
  });
});

describe("isoToDdMmYy", () => {
  it("formats ISO to dd/mm/yy", () => {
    expect(isoToDdMmYy("2026-07-09")).toBe("09/07/26");
  });

  it("handles non-matching strings gracefully", () => {
    expect(isoToDdMmYy("not-a-date")).toBe("not-a-date");
  });
});

describe("parseFiltersFromQuery", () => {
  it("defaults to created_at desc with no params", () => {
    const f = parseFiltersFromQuery({});
    expect(f.sortBy).toBe("created_at");
    expect(f.sortDir).toBe("desc");
    expect(f.statuses).toBeUndefined();
    expect(f.customer).toBeUndefined();
  });

  it("parses single valid status into array", () => {
    const f = parseFiltersFromQuery({ status: "paid" });
    expect(f.statuses).toEqual(["paid"]);
  });

  it("parses comma-separated multi-status", () => {
    const f = parseFiltersFromQuery({ status: "paid,failed,pending" });
    expect(f.statuses).toEqual(["paid", "failed", "pending"]);
  });

  it("filters out unknown statuses, keeps valid ones", () => {
    const f = parseFiltersFromQuery({ status: "paid,unknown_status,failed" });
    expect(f.statuses).toEqual(["paid", "failed"]);
  });

  it("ignores status param with only invalid values", () => {
    const f = parseFiltersFromQuery({ status: "unknown_status" });
    expect(f.statuses).toBeUndefined();
  });

  it("parses customer name", () => {
    const f = parseFiltersFromQuery({ customer: "  ישראל  " });
    expect(f.customer).toBe("ישראל");
  });

  it("ignores blank customer", () => {
    const f = parseFiltersFromQuery({ customer: "   " });
    expect(f.customer).toBeUndefined();
  });

  it("parses valid date range", () => {
    const f = parseFiltersFromQuery({ from: "01/07/26", to: "31/07/26" });
    expect(f.dateFrom).toBe("2026-07-01");
    expect(f.dateTo).toBe("2026-07-31");
    expect(f.dateFromDisplay).toBe("01/07/26");
    expect(f.dateToDisplay).toBe("31/07/26");
    expect(f.dateFromError).toBeUndefined();
    expect(f.dateToError).toBeUndefined();
  });

  it("sets dateFromError for invalid from date", () => {
    const f = parseFiltersFromQuery({ from: "baddate" });
    expect(f.dateFrom).toBeUndefined();
    expect(f.dateFromDisplay).toBe("baddate");
    expect(f.dateFromError).toBe("תאריך לא תקין");
  });

  it("sets dateToError for invalid to date", () => {
    const f = parseFiltersFromQuery({ to: "99/99/99" });
    expect(f.dateTo).toBeUndefined();
    expect(f.dateToError).toBe("תאריך לא תקין");
  });

  it("parses valid sort field", () => {
    const f = parseFiltersFromQuery({ sort: "amount_agorot", dir: "asc" });
    expect(f.sortBy).toBe("amount_agorot");
    expect(f.sortDir).toBe("asc");
  });

  it("ignores unknown sort field, falls back to default", () => {
    const f = parseFiltersFromQuery({ sort: "DROP TABLE payments" });
    expect(f.sortBy).toBe("created_at");
  });

  it("ignores unknown sort dir, falls back to default", () => {
    const f = parseFiltersFromQuery({ dir: "sideways" });
    expect(f.sortDir).toBe("desc");
  });
});

describe("hasActiveFilters", () => {
  it("returns false for default filters", () => {
    const f = parseFiltersFromQuery({});
    expect(hasActiveFilters(f)).toBe(false);
  });

  it("returns true when statuses are set", () => {
    const f = parseFiltersFromQuery({ status: "paid" });
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("returns true when multiple statuses are set", () => {
    const f = parseFiltersFromQuery({ status: "paid,failed" });
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("returns true when customer is set", () => {
    const f = parseFiltersFromQuery({ customer: "ישראל" });
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("returns true when dateFrom is valid", () => {
    const f = parseFiltersFromQuery({ from: "01/07/26" });
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("returns true when dateFrom is invalid (shows error)", () => {
    const f = parseFiltersFromQuery({ from: "bad" });
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("returns false with only non-default sort", () => {
    const f = parseFiltersFromQuery({ sort: "amount_agorot" });
    expect(hasActiveFilters(f)).toBe(false);
  });
});

describe("buildFilterUrl", () => {
  it("returns base path when all defaults", () => {
    const url = buildFilterUrl("/admin/payments", {
      sortBy: "created_at",
      sortDir: "desc"
    });
    expect(url).toBe("/admin/payments");
  });

  it("includes status param for single status", () => {
    const url = buildFilterUrl("/admin/payments", {
      statuses: ["paid"],
      sortBy: "created_at",
      sortDir: "desc"
    });
    expect(url).toContain("status=paid");
  });

  it("includes comma-separated status param for multiple statuses", () => {
    const url = buildFilterUrl("/admin/payments", {
      statuses: ["paid", "failed"],
      sortBy: "created_at",
      sortDir: "desc"
    });
    expect(url).toContain("status=paid%2Cfailed");
  });

  it("omits status param when statuses array is empty", () => {
    const url = buildFilterUrl("/admin/payments", {
      statuses: [],
      sortBy: "created_at",
      sortDir: "desc"
    });
    expect(url).not.toContain("status=");
  });

  it("includes sort param when non-default", () => {
    const url = buildFilterUrl("/admin/payments", {
      sortBy: "amount_agorot",
      sortDir: "desc"
    });
    expect(url).toContain("sort=amount_agorot");
    expect(url).not.toContain("dir=");
  });

  it("includes dir when asc", () => {
    const url = buildFilterUrl("/admin/payments", {
      sortBy: "created_at",
      sortDir: "asc"
    });
    expect(url).not.toContain("sort=");
    expect(url).toContain("dir=asc");
  });

  it("does not include dateFrom when dateFrom is not set (invalid date)", () => {
    const url = buildFilterUrl("/admin/payments", {
      dateFromDisplay: "bad",
      dateFromError: "תאריך לא תקין",
      sortBy: "created_at",
      sortDir: "desc"
    });
    expect(url).toBe("/admin/payments");
  });

  it("includes from param when dateFrom is valid", () => {
    const url = buildFilterUrl("/admin/payments", {
      dateFrom: "2026-07-09",
      dateFromDisplay: "09/07/26",
      sortBy: "created_at",
      sortDir: "desc"
    });
    expect(url).toContain("from=");
    expect(url).toContain("09%2F07%2F26");
  });

  it("includes offset in pagination links", () => {
    const url = buildFilterUrl(
      "/admin/payments",
      { sortBy: "created_at", sortDir: "desc" },
      { offset: 20, limit: 20 }
    );
    expect(url).toContain("offset=20");
    expect(url).toContain("limit=20");
  });
});

describe("buildSortUrl", () => {
  it("sets sort and defaults to desc when clicking new column", () => {
    const filters = parseFiltersFromQuery({});
    const url = buildSortUrl("/admin/payments", filters, "amount_agorot");
    expect(url).toContain("sort=amount_agorot");
    expect(url).not.toContain("dir=");
  });

  it("toggles to asc when clicking active desc column", () => {
    const filters = parseFiltersFromQuery({
      sort: "amount_agorot",
      dir: "desc"
    });
    const url = buildSortUrl("/admin/payments", filters, "amount_agorot");
    expect(url).toContain("sort=amount_agorot");
    expect(url).toContain("dir=asc");
  });

  it("toggles to desc when clicking active asc column", () => {
    const filters = parseFiltersFromQuery({
      sort: "amount_agorot",
      dir: "asc"
    });
    const url = buildSortUrl("/admin/payments", filters, "amount_agorot");
    expect(url).toContain("sort=amount_agorot");
    expect(url).not.toContain("dir=asc");
  });

  it("preserves active filters in sort URL", () => {
    const filters = parseFiltersFromQuery({
      status: "paid",
      sort: "created_at"
    });
    const url = buildSortUrl("/admin/payments", filters, "customer_name");
    expect(url).toContain("status=paid");
    expect(url).toContain("sort=customer_name");
  });
});

describe("buildChips", () => {
  it("returns empty array for default filters", () => {
    const f = parseFiltersFromQuery({});
    expect(
      buildChips("/admin/payments", f, getPaymentStatusLabel)
    ).toHaveLength(0);
  });

  it("generates one status chip per selected status", () => {
    const f = parseFiltersFromQuery({ status: "paid" });
    const chips = buildChips("/admin/payments", f, getPaymentStatusLabel);
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toContain("שולם");
    expect(chips[0].removeUrl).not.toContain("status=paid");
  });

  it("generates separate chips for multiple statuses", () => {
    const f = parseFiltersFromQuery({ status: "paid,failed" });
    const chips = buildChips("/admin/payments", f, getPaymentStatusLabel);
    expect(chips).toHaveLength(2);
    const labels = chips.map((c) => c.label);
    expect(labels.some((l) => l.includes("שולם"))).toBe(true);
    expect(labels.some((l) => l.includes("נכשל"))).toBe(true);
  });

  it("remove URL for one status keeps the other", () => {
    const f = parseFiltersFromQuery({ status: "paid,failed" });
    const chips = buildChips("/admin/payments", f, getPaymentStatusLabel);
    const paidChip = chips.find((c) => c.label.includes("שולם"));
    expect(paidChip?.removeUrl).toContain("status=failed");
    expect(paidChip?.removeUrl).not.toContain("status=paid");
  });

  it("generates customer chip", () => {
    const f = parseFiltersFromQuery({ customer: "ישראל" });
    const chips = buildChips("/admin/payments", f, getPaymentStatusLabel);
    expect(chips[0].label).toContain("ישראל");
    expect(chips[0].removeUrl).not.toContain("customer=");
  });

  it("generates single date range chip for valid range", () => {
    const f = parseFiltersFromQuery({ from: "01/07/26", to: "31/07/26" });
    const chips = buildChips("/admin/payments", f, getPaymentStatusLabel);
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toContain("01/07/26");
    expect(chips[0].label).toContain("31/07/26");
  });

  it("does not generate a chip for invalid (unparsed) date", () => {
    const f = parseFiltersFromQuery({ from: "baddate", status: "paid" });
    const chips = buildChips("/admin/payments", f, getPaymentStatusLabel);
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toContain("שולם");
  });

  it("remove chip for date range clears both from and to", () => {
    const f = parseFiltersFromQuery({
      from: "01/07/26",
      to: "31/07/26",
      status: "paid"
    });
    const chips = buildChips("/admin/payments", f, getPaymentStatusLabel);
    const rangeChip = chips.find((c) => c.label.includes("טווח"));
    expect(rangeChip?.removeUrl).toContain("status=paid");
    expect(rangeChip?.removeUrl).not.toContain("from=");
    expect(rangeChip?.removeUrl).not.toContain("to=");
  });
});
