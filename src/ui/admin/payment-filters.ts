import { isPaymentStatus } from "../../domain/payments/payment-status";
import type { PaymentStatus } from "../../domain/payments/payment-status";
import type {
  PaymentSortDir as SortDir,
  PaymentSortField as SortField
} from "../../domain/payments/payment-repository";

export type { SortDir, SortField };

export const ALLOWED_SORT_FIELDS: ReadonlyArray<SortField> = [
  "created_at",
  "customer_name",
  "amount_agorot",
  "status"
];

export interface ParsedFilters {
  dateFrom?: string; // ISO yyyy-mm-dd (for DB query)
  dateTo?: string; // ISO yyyy-mm-dd (for DB query)
  dateFromDisplay?: string; // dd/mm/yy (for input value display)
  dateToDisplay?: string; // dd/mm/yy (for input value display)
  dateFromError?: string;
  dateToError?: string;
  customer?: string;
  status?: PaymentStatus;
  sortBy: SortField;
  sortDir: SortDir;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Parse dd/mm/yy (or d/m/yy) → ISO yyyy-mm-dd.
 * Two-digit year maps to 2000–2099.
 * Returns null for invalid input or invalid calendar date.
 */
export function parseDdMmYy(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = 2000 + parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Round-trip validates impossible dates like Feb 31
  const d = new Date(`${iso}T12:00:00Z`);
  if (
    isNaN(d.getTime()) ||
    d.getUTCDate() !== day ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCFullYear() !== year
  ) {
    return null;
  }
  return iso;
}

/** Format ISO yyyy-mm-dd → dd/mm/yy for display. */
export function isoToDdMmYy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

// ── Query parsing ─────────────────────────────────────────────────────────────

export function parseFiltersFromQuery(
  query: Record<string, string | undefined>
): ParsedFilters {
  const filters: ParsedFilters = { sortBy: "created_at", sortDir: "desc" };

  const status = query["status"];
  if (status && isPaymentStatus(status)) {
    filters.status = status;
  }

  const customer = query["customer"];
  if (customer && customer.trim()) {
    filters.customer = customer.trim();
  }

  const from = query["from"];
  if (from && from.trim()) {
    filters.dateFromDisplay = from.trim();
    const iso = parseDdMmYy(from.trim());
    if (iso) {
      filters.dateFrom = iso;
    } else {
      filters.dateFromError = "תאריך לא תקין";
    }
  }

  const to = query["to"];
  if (to && to.trim()) {
    filters.dateToDisplay = to.trim();
    const iso = parseDdMmYy(to.trim());
    if (iso) {
      filters.dateTo = iso;
    } else {
      filters.dateToError = "תאריך לא תקין";
    }
  }

  const sort = query["sort"];
  if (sort && (ALLOWED_SORT_FIELDS as ReadonlyArray<string>).includes(sort)) {
    filters.sortBy = sort as SortField;
  }

  const dir = query["dir"];
  if (dir === "asc" || dir === "desc") {
    filters.sortDir = dir;
  }

  return filters;
}

// ── Filter state ──────────────────────────────────────────────────────────────

/** True when any non-sort filter is active (including invalid date entries). */
export function hasActiveFilters(filters: ParsedFilters): boolean {
  return !!(
    filters.status ||
    filters.customer ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.dateFromError ||
    filters.dateToError
  );
}

// ── URL builders ──────────────────────────────────────────────────────────────

/**
 * Build a payments list URL preserving all current filter state.
 * Only includes non-default sort params (created_at desc is the default).
 * Only includes dates that successfully parsed (skips invalid entries).
 */
export function buildFilterUrl(
  basePath: string,
  filters: Partial<ParsedFilters>,
  extras: { offset?: number; limit?: number } = {}
): string {
  const p = new URLSearchParams();
  if (filters.status) p.set("status", filters.status);
  if (filters.customer) p.set("customer", filters.customer);
  if (filters.dateFrom) {
    p.set("from", filters.dateFromDisplay ?? isoToDdMmYy(filters.dateFrom));
  }
  if (filters.dateTo) {
    p.set("to", filters.dateToDisplay ?? isoToDdMmYy(filters.dateTo));
  }
  if (filters.sortBy && filters.sortBy !== "created_at")
    p.set("sort", filters.sortBy);
  if (filters.sortDir && filters.sortDir !== "desc")
    p.set("dir", filters.sortDir);
  if (extras.limit != null) p.set("limit", String(extras.limit));
  if (extras.offset != null && extras.offset > 0)
    p.set("offset", String(extras.offset));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Build a sort-toggle URL for a column header.
 * Clicking the same column reverses direction; clicking a new column defaults to desc.
 */
export function buildSortUrl(
  basePath: string,
  filters: ParsedFilters,
  field: SortField
): string {
  const isCurrent = filters.sortBy === field;
  const newDir: SortDir =
    isCurrent && filters.sortDir === "desc" ? "asc" : "desc";
  return buildFilterUrl(basePath, {
    ...filters,
    sortBy: field,
    sortDir: newDir
  });
}

/**
 * Build chip descriptors for all active (successfully applied) filters.
 * Each chip has a label and a URL that removes only that filter.
 */
export function buildChips(
  basePath: string,
  filters: ParsedFilters,
  getStatusLabel: (s: PaymentStatus) => string
): Array<{ label: string; removeUrl: string }> {
  const chips: Array<{ label: string; removeUrl: string }> = [];

  if (filters.status) {
    chips.push({
      label: `סטטוס: ${getStatusLabel(filters.status)}`,
      removeUrl: buildFilterUrl(basePath, { ...filters, status: undefined })
    });
  }
  if (filters.customer) {
    chips.push({
      label: `לקוח: ${filters.customer}`,
      removeUrl: buildFilterUrl(basePath, { ...filters, customer: undefined })
    });
  }
  if (filters.dateFrom) {
    chips.push({
      label: `מתאריך: ${filters.dateFromDisplay ?? isoToDdMmYy(filters.dateFrom)}`,
      removeUrl: buildFilterUrl(basePath, {
        ...filters,
        dateFrom: undefined,
        dateFromDisplay: undefined,
        dateFromError: undefined
      })
    });
  }
  if (filters.dateTo) {
    chips.push({
      label: `עד: ${filters.dateToDisplay ?? isoToDdMmYy(filters.dateTo)}`,
      removeUrl: buildFilterUrl(basePath, {
        ...filters,
        dateTo: undefined,
        dateToDisplay: undefined,
        dateToError: undefined
      })
    });
  }

  return chips;
}
