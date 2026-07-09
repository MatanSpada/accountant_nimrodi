import type { InvoiceRecord } from "../../domain/invoices/invoice-types";
import type { PaymentListResult } from "../../domain/payments/payment-repository";
import {
  isFinalPaymentStatus,
  PAYMENT_STATUSES
} from "../../domain/payments/payment-status";
import type { Payment } from "../../domain/payments/payment-types";
import type { PaymentWebhookRecord } from "../../domain/payments/payment-webhook-types";
import type { AppConfig } from "../../shared/config/app-config";
import { escapeHtml, formatAmountAgorot, formatDateTime } from "./formatters";
import { getInvoiceStatusLabel } from "./invoice-status-labels";
import type { ParsedFilters, SortField } from "./payment-filters";
import {
  buildChips,
  buildFilterUrl,
  buildSortUrl,
  hasActiveFilters
} from "./payment-filters";
import { getPaymentStatusLabel, PAYMENT_STATUS_LABELS } from "./status-labels";
import { buildWhatsAppLink } from "./whatsapp-helper";

export interface PaymentListItemView {
  payment: Payment;
  invoice: InvoiceRecord | null;
}

export interface DashboardMetrics {
  totalRequests: number;
  paidCount: number;
  pendingCount: number;
  paidAmountAgorot: number;
  pendingAmountAgorot: number;
  statusBreakdown: Array<{
    status: Payment["status"];
    label: string;
    count: number;
  }>;
}

function getEnvironmentLabel(appEnv: AppConfig["appEnv"]) {
  if (appEnv === "development") return "פיתוח";
  if (appEnv === "staging") return "בדיקות";
  return "ייצור";
}

function getGrowModeLabel(appConfig: AppConfig) {
  if (appConfig.growMode === "mock") return "דמו";
  if (appConfig.growMode === "sandbox") return "סביבת בדיקות";
  return "ייצור";
}

function getProviderLabel(provider: string) {
  if (provider === "mock-grow" || provider === "mock_grow") return "דמו";
  if (provider === "grow") return "GROW";
  return provider;
}

function getInvoiceDisplayState(invoice: InvoiceRecord | null) {
  if (!invoice) return "טרם נוצר מסמך";
  if (invoice.status === "created") return "מסמך זמין";
  if (invoice.status === "failed") return "נדרשת בדיקה";
  return getInvoiceStatusLabel(invoice.status);
}

function getWebhookProcessingStatusLabel(
  status: PaymentWebhookRecord["processingStatus"]
) {
  if (status === "processed") return "עובד";
  if (status === "failed") return "נכשל";
  return status;
}

function getWebhookEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    "payment.paid": "תשלום שולם",
    "payment.failed": "תשלום נכשל",
    "payment.cancelled": "תשלום בוטל",
    "payment.expired": "תשלום פג תוקף"
  };
  return labels[eventType] ?? eventType;
}

const APP_VERSION = "גרסת בטא";

const CSS = `
  :root {
    --bg: #f0f2f5;
    --surface: #ffffff;
    --surface-soft: #f7f8fa;
    --surface-muted: #eef0f4;
    --ink: #0d1b2a;
    --ink-soft: #4a5568;
    --ink-faint: #8896a8;
    --line: #e2e8f0;
    --line-strong: #cbd5e1;
    --brand: #1e3a5f;
    --brand-light: #2c5282;
    --brand-soft: #e8eef6;
    --accent: #2563eb;
    --accent-soft: #dbeafe;
    --success: #15803d;
    --success-soft: #dcfce7;
    --warning: #b45309;
    --warning-soft: #fef3c7;
    --danger: #b91c1c;
    --danger-soft: #fee2e2;
    --shadow-xs: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-sm: 0 4px 12px rgba(0,0,0,0.06);
    --shadow-md: 0 8px 24px rgba(0,0,0,0.08);
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --font: "Noto Sans Hebrew", "Segoe UI", system-ui, sans-serif;
    --sidebar-w: 240px;
  }

  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: var(--font);
    color: var(--ink);
    background: var(--bg);
    font-size: 0.925rem;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  a { color: var(--accent); text-decoration: none; }
  a:hover { color: var(--brand); }
  button, input, textarea, select { font: inherit; }

  /* ── Layout ── */
  .layout {
    display: grid;
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    min-height: 100vh;
  }

  /* ── Sidebar ── */
  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background: #111827;
    color: #e5e7eb;
    padding: 0;
  }

  .sidebar-top {
    padding: 24px 20px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .brand-eyebrow {
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #6b7280;
    margin-bottom: 6px;
    display: block;
  }

  .brand-name {
    font-size: 1rem;
    font-weight: 600;
    color: #f9fafb;
    margin: 0;
    line-height: 1.3;
  }

  .sidebar-nav {
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .nav-label {
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6b7280;
    padding: 8px 8px 4px;
    margin-top: 8px;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    color: #9ca3af;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 150ms ease, color 150ms ease;
    position: relative;
    text-decoration: none;
  }

  .nav-link:hover {
    background: rgba(255,255,255,0.06);
    color: #e5e7eb;
  }

  .nav-link.active {
    background: rgba(37,99,235,0.18);
    color: #93c5fd;
  }

  .nav-link.active::before {
    content: "";
    position: absolute;
    right: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 3px 0 0 3px;
    background: #3b82f6;
  }

  .nav-icon {
    width: 16px;
    height: 16px;
    opacity: 0.75;
    flex-shrink: 0;
  }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .sidebar-env {
    font-size: 0.75rem;
    color: #6b7280;
    padding: 6px 8px;
    margin-bottom: 6px;
    line-height: 1.5;
  }

  /* ── Main Content ── */
  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Topbar ── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 32px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .page-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .env-badge {
    font-size: 0.75rem;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--warning-soft);
    color: var(--warning);
    font-weight: 500;
    border: 1px solid rgba(180,83,9,0.12);
  }

  /* ── Page Content Area ── */
  .page-content {
    padding: 28px 32px;
    flex: 1;
  }

  /* ── Section label (Power BI style) ── */
  .section-label {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 0 0 12px;
  }

  /* ── KPI Row ── */
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 20px;
    box-shadow: var(--shadow-xs);
    transition: box-shadow 200ms ease, transform 200ms ease;
  }

  .kpi-card:hover {
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }

  .kpi-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
    display: block;
  }

  .kpi-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
    margin-bottom: 6px;
    display: block;
  }

  .kpi-value.accent { color: var(--accent); }
  .kpi-value.success { color: var(--success); }

  .kpi-sub {
    font-size: 0.8rem;
    color: var(--ink-faint);
  }

  /* ── Card ── */
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 24px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .card-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ink);
  }

  /* ── Dashboard grid ── */
  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 20px;
    margin-bottom: 20px;
  }

  .dashboard-sidebar-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Recent payments (simplified dashboard table) ── */
  .recent-table {
    width: 100%;
    border-collapse: collapse;
  }

  .recent-table th {
    text-align: right;
    padding: 0 12px 10px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--ink-faint);
    border-bottom: 1px solid var(--line);
  }

  .recent-table td {
    text-align: right;
    padding: 11px 12px;
    font-size: 0.875rem;
    border-bottom: 1px solid var(--line);
    vertical-align: middle;
  }

  .recent-table tbody tr:last-child td {
    border-bottom: none;
  }

  .recent-table tbody tr {
    transition: background 120ms ease;
    cursor: pointer;
  }

  .recent-table tbody tr:hover {
    background: var(--surface-soft);
  }

  /* ── Breakdown ── */
  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .breakdown-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .breakdown-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
  }

  .breakdown-meta .b-label { color: var(--ink-soft); }
  .breakdown-meta .b-count { font-weight: 600; color: var(--ink); font-size: 0.85rem; }

  .breakdown-track {
    height: 5px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }

  .breakdown-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--brand-light), var(--accent));
    transition: width 600ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* ── Quick actions ── */
  .quick-links {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .quick-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    background: var(--surface-soft);
    border: 1px solid var(--line);
    color: var(--ink);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
  }

  .quick-link:hover {
    background: var(--surface-muted);
    border-color: var(--line-strong);
    color: var(--ink);
    transform: translateX(-2px);
  }

  .quick-link-arrow {
    color: var(--ink-faint);
    font-size: 0.9rem;
  }

  /* ── Full table (payments list) ── */
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th {
    text-align: right;
    padding: 0 14px 12px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--ink-faint);
    border-bottom: 2px solid var(--line);
    white-space: nowrap;
  }

  .data-table td {
    text-align: right;
    padding: 14px 14px;
    font-size: 0.875rem;
    border-bottom: 1px solid var(--line);
    vertical-align: middle;
  }

  .data-table tbody tr {
    transition: background 120ms ease;
    cursor: pointer;
  }

  .data-table tbody tr:hover { background: var(--surface-soft); }
  .data-table tbody tr:last-child td { border-bottom: none; }

  .cell-primary { font-weight: 600; color: var(--ink); }
  .cell-secondary { color: var(--ink-faint); font-size: 0.8rem; margin-top: 2px; }
  .amount-strong { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); }

  /* ── Status badges ── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 500;
    white-space: nowrap;
    line-height: 1.5;
  }

  .badge::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .badge-default { background: var(--brand-soft); color: var(--brand); }
  .badge-default::before { background: var(--brand-light); }
  .badge-success { background: var(--success-soft); color: var(--success); }
  .badge-success::before { background: var(--success); }
  .badge-warning { background: var(--warning-soft); color: var(--warning); }
  .badge-warning::before { background: var(--warning); }
  .badge-danger { background: var(--danger-soft); color: var(--danger); }
  .badge-danger::before { background: var(--danger); }
  .badge-neutral { background: var(--surface-muted); color: var(--ink-soft); }
  .badge-neutral::before { background: var(--ink-faint); }

  /* ── Inline code ── */
  .inline-code {
    direction: ltr;
    display: block;
    background: var(--surface-soft);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85rem;
    word-break: break-all;
    color: var(--ink-soft);
    margin-bottom: 14px;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 38px;
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
    text-decoration: none;
    line-height: 1;
  }

  .btn:active { transform: scale(0.98); }

  .btn-primary {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 2px 6px rgba(37,99,235,0.25);
  }

  .btn-primary:hover {
    background: #1d4ed8;
    color: #fff;
    box-shadow: 0 4px 12px rgba(37,99,235,0.3);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--line);
  }

  .btn-secondary:hover {
    background: var(--surface-soft);
    color: var(--ink);
    border-color: var(--line-strong);
  }

  .btn-ghost {
    background: transparent;
    color: var(--ink-soft);
    border: 1px solid transparent;
  }

  .btn-ghost:hover {
    background: var(--surface-soft);
    color: var(--ink);
  }

  .btn-whatsapp {
    background: #16a34a;
    color: #fff;
  }

  .btn-whatsapp:hover {
    background: #15803d;
    color: #fff;
    transform: translateY(-1px);
  }

  .btn-danger {
    background: var(--danger-soft);
    color: var(--danger);
    border: 1px solid rgba(185,28,28,0.15);
  }

  .btn-danger:hover { background: #fecaca; }

  .btn-sm {
    min-height: 30px;
    padding: 0 12px;
    font-size: 0.8rem;
  }

  .btn-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* ── Forms ── */
  .form-shell {
    max-width: 640px;
  }

  .form-grid {
    display: grid;
    gap: 18px;
  }

  .form-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--ink-soft);
  }

  input[type="text"],
  input[type="email"],
  input[type="number"],
  input[type="password"],
  input:not([type]),
  textarea {
    width: 100%;
    padding: 10px 13px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font-size: 0.9rem;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }

  textarea { min-height: 110px; resize: vertical; }

  input::placeholder, textarea::placeholder { color: var(--ink-faint); }

  /* ── Detail layout ── */
  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--line);
  }

  .detail-customer {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 4px;
    line-height: 1.2;
  }

  .detail-desc {
    color: var(--ink-soft);
    font-size: 0.9rem;
    margin: 0;
  }

  .detail-status-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }

  .detail-amount {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .split-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
    gap: 20px;
    margin-bottom: 20px;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Summary grid (detail page) ── */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .summary-cell {
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    background: var(--surface-soft);
    border: 1px solid var(--line);
  }

  .summary-cell strong {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 5px;
  }

  .summary-cell span {
    font-size: 0.9rem;
    color: var(--ink);
    line-height: 1.4;
  }

  /* ── Timeline ── */
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .timeline-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid var(--line);
    font-size: 0.875rem;
  }

  .timeline-item:last-child { border-bottom: none; }

  .timeline-item .t-label { color: var(--ink-soft); }
  .timeline-item .t-value { color: var(--ink); font-variant-numeric: tabular-nums; }

  /* ── Technical items (webhooks) ── */
  .tech-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tech-item {
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    background: var(--surface-soft);
    border: 1px solid var(--line);
  }

  .tech-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }

  .tech-field strong {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 3px;
  }

  .tech-field span {
    font-size: 0.85rem;
    color: var(--ink-soft);
    word-break: break-all;
  }

  /* ── Disclosure ── */
  .disclosure {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .disclosure + .disclosure {
    margin-top: 12px;
  }

  .disclosure summary {
    list-style: none;
    cursor: pointer;
    padding: 14px 18px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ink-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    user-select: none;
    transition: background 120ms ease, color 120ms ease;
  }

  .disclosure summary:hover { background: var(--surface-soft); color: var(--ink); }
  .disclosure summary::-webkit-details-marker { display: none; }

  .disclosure summary::after {
    content: "›";
    font-size: 1rem;
    color: var(--ink-faint);
    transition: transform 180ms ease;
    transform: rotate(90deg);
  }

  .disclosure[open] summary::after { transform: rotate(-90deg); }

  .disclosure-body {
    padding: 0 18px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-top: 1px solid var(--line);
  }

  /* ── Alert boxes ── */
  .alert {
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    line-height: 1.65;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .alert-info { background: var(--surface-soft); border: 1px solid var(--line); color: var(--ink-soft); }
  .alert-success { background: var(--success-soft); border: 1px solid rgba(21,128,61,0.2); color: var(--success); }
  .alert-warning { background: var(--warning-soft); border: 1px solid rgba(180,83,9,0.2); color: var(--warning); }
  .alert-danger { background: var(--danger-soft); border: 1px solid rgba(185,28,28,0.2); color: var(--danger); }

  /* ── Empty state ── */
  .empty {
    padding: 32px 20px;
    text-align: center;
    color: var(--ink-faint);
    font-size: 0.875rem;
    line-height: 1.7;
  }

  /* ── Pagination ── */
  .pagination {
    display: flex;
    gap: 8px;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
    justify-content: flex-start;
  }

  /* ── Copy toast ── */
  .copy-anchor {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .copy-toast {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 130px;
    padding: 7px 11px;
    border-radius: var(--radius-sm);
    background: var(--ink);
    color: #fff;
    font-size: 0.8rem;
    opacity: 0;
    transform: translateY(-3px);
    pointer-events: none;
    transition: opacity 150ms ease, transform 150ms ease;
    white-space: nowrap;
    z-index: 20;
    box-shadow: var(--shadow-sm);
  }

  .copy-toast.visible { opacity: 1; transform: translateY(0); }

  /* ── Login page ── */
  .login-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: var(--bg);
  }

  .login-card {
    width: min(440px, 100%);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 36px 32px;
    box-shadow: var(--shadow-md);
  }

  .login-eyebrow {
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 10px;
    display: block;
  }

  .login-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 8px;
  }

  .login-subtitle {
    color: var(--ink-soft);
    font-size: 0.875rem;
    line-height: 1.65;
    margin: 0 0 24px;
  }

  .login-form label {
    margin-bottom: 18px;
  }

  /* ── Status page ── */
  .status-page { max-width: 600px; }

  /* ── Responsive ── */
  @media (max-width: 1280px) {
    .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dashboard-grid { grid-template-columns: 1fr; }
    .dashboard-sidebar-stack { flex-direction: row; }
  }

  @media (max-width: 1024px) {
    .split-grid { grid-template-columns: 1fr; }
    .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { height: auto; position: static; flex-direction: row; flex-wrap: wrap; padding: 0; }
    .sidebar-top { flex: 1; padding: 16px 20px; border-bottom: none; border-left: 1px solid rgba(255,255,255,0.06); }
    .sidebar-nav { flex-direction: row; padding: 8px 12px; flex: none; width: 100%; gap: 4px; border-top: 1px solid rgba(255,255,255,0.06); }
    .sidebar-footer { display: none; }
    .page-content, .topbar { padding-left: 20px; padding-right: 20px; }
    .dashboard-sidebar-stack { flex-direction: column; }
  }

  @media (max-width: 640px) {
    .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .form-grid-2 { grid-template-columns: 1fr; }
    .summary-grid { grid-template-columns: 1fr; }
    .tech-grid { grid-template-columns: 1fr; }
    .page-content { padding: 16px; }
    .topbar { padding: 14px 16px; }
  }

  /* ── KPI cards as navigation links ── */
  a.kpi-card {
    text-decoration: none;
    color: inherit;
    display: block;
    cursor: pointer;
  }

  a.kpi-card:hover {
    transform: translateY(-2px);
    border-color: rgba(37,99,235,0.28);
    box-shadow: var(--shadow-sm);
  }

  /* ── Breakdown rows as links ── */
  a.breakdown-row {
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 4px 8px;
    margin: -4px -8px;
    border-radius: var(--radius-sm);
    transition: background 120ms;
  }

  a.breakdown-row:hover { background: var(--surface-soft); }
  a.breakdown-row .b-label { color: var(--ink-soft); transition: color 120ms; }
  a.breakdown-row:hover .b-label { color: var(--accent); }

  /* ── Filter bar ── */
  .filter-bar {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    flex-wrap: wrap;
    padding: 14px 16px;
    background: var(--surface-soft);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    margin-bottom: 14px;
  }

  .filter-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-field-label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  .filter-input {
    height: 34px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.85rem;
    width: 110px;
    transition: border-color 150ms, box-shadow 150ms;
  }

  .filter-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(37,99,235,0.08);
  }

  .filter-input-wide { width: 170px; }

  .filter-select {
    height: 34px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 150ms;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .filter-actions {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-right: auto;
  }

  .filter-error {
    font-size: 0.7rem;
    color: var(--danger);
    line-height: 1.3;
  }

  /* ── Active filter chips ── */
  .chips-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 12px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px 4px 6px;
    background: var(--accent-soft);
    border: 1px solid rgba(37,99,235,0.2);
    border-radius: 999px;
    font-size: 0.78rem;
    color: #1d4ed8;
    font-weight: 500;
    white-space: nowrap;
  }

  .chip-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(37,99,235,0.14);
    color: #1d4ed8;
    font-size: 0.7rem;
    text-decoration: none;
    flex-shrink: 0;
    transition: background 120ms;
  }

  .chip-x:hover { background: rgba(37,99,235,0.28); color: #1d4ed8; }

  .chips-clear {
    font-size: 0.78rem;
    color: var(--ink-faint);
    text-decoration: none;
    padding: 4px 8px;
    border-radius: 999px;
    transition: background 120ms, color 120ms;
  }

  .chips-clear:hover { background: var(--surface-muted); color: var(--ink-soft); }

  /* ── Sortable column headers ── */
  .sort-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    text-decoration: none;
    color: inherit;
    white-space: nowrap;
    transition: color 120ms;
  }

  .sort-link:hover { color: var(--ink); }
  .sort-link.active { color: var(--accent); }

  .sort-arrow {
    font-size: 0.65rem;
    opacity: 0.9;
  }
`;

const SHARED_JS = `
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("[data-copy-text]");
    if (!(button instanceof HTMLElement)) return;
    const text = button.getAttribute("data-copy-text");
    if (!text) return;
    const feedbackId = button.getAttribute("data-copy-feedback");
    const feedback = feedbackId ? document.getElementById(feedbackId) : null;
    if (!(feedback instanceof HTMLElement)) return;
    if (feedback.dataset.timeoutId) window.clearTimeout(Number(feedback.dataset.timeoutId));
    const showToast = (message) => {
      feedback.textContent = message;
      feedback.classList.add("visible");
      const tid = window.setTimeout(() => feedback.classList.remove("visible"), 2000);
      feedback.dataset.timeoutId = String(tid);
    };
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast("הקישור הועתק");
      } else {
        showToast("העתקה לא נתמכת");
      }
    } catch {
      showToast("לא ניתן להעתיק");
    }
  });

  document.addEventListener("submit", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;
    if (!target.hasAttribute("data-mock-webhook-form") && !target.hasAttribute("data-mock-invoice-form")) return;
    event.preventDefault();
    try {
      let query;
      if (target.hasAttribute("data-mock-webhook-form")) {
        const formData = new FormData(target);
        const payload = Object.fromEntries(formData.entries());
        payload.amount_agorot = Number(payload.amount_agorot);
        payload.occurred_at = new Date().toISOString();
        const response = await fetch("/api/mock-grow/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json();
        query = new URLSearchParams({ simulator_outcome: String(data.outcome || "failed"), simulator_message: String(data.message || "פעולת ההדגמה הסתיימה.") });
      } else {
        const endpoint = target.getAttribute("data-endpoint");
        if (!endpoint) throw new Error("חסר יעד ליצירת מסמך.");
        const response = await fetch(endpoint, { method: "POST" });
        const data = await response.json();
        query = new URLSearchParams({ invoice_outcome: String(data.outcome || "failed"), invoice_message: String(data.message || "פעולת יצירת המסמך הסתיימה.") });
      }
      const redirectBase = target.getAttribute("data-redirect") || window.location.pathname;
      window.location.href = redirectBase + "?" + query.toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : target.hasAttribute("data-mock-webhook-form") ? "לא ניתן היה להשלים את פעולת ההדגמה." : "לא ניתן היה ליצור מסמך.";
      const redirectBase = target.getAttribute("data-redirect") || window.location.pathname;
      const key = target.hasAttribute("data-mock-webhook-form") ? "simulator" : "invoice";
      const query = new URLSearchParams({ [key + "_outcome"]: "failed", [key + "_message"]: message });
      window.location.href = redirectBase + "?" + query.toString();
    }
  });
`;

// ── Filter bar, chips, and sort header helpers ────────────────────────────────

const BASE_PATH = "/admin/payments";

function renderFilterBar(
  filters: ParsedFilters,
  customerNames: string[]
): string {
  const clearSortUrl = buildFilterUrl(BASE_PATH, {
    sortBy: filters.sortBy,
    sortDir: filters.sortDir
  });
  return `
    <form class="filter-bar" method="GET" action="${BASE_PATH}">
      <div class="filter-field">
        <span class="filter-field-label">מתאריך</span>
        <input class="filter-input" type="text" name="from"
          value="${escapeHtml(filters.dateFromDisplay ?? "")}"
          placeholder="dd/mm/yy"
          autocomplete="off"
          maxlength="8" />
        ${filters.dateFromError ? `<span class="filter-error">${escapeHtml(filters.dateFromError)}</span>` : ""}
      </div>
      <div class="filter-field">
        <span class="filter-field-label">עד תאריך</span>
        <input class="filter-input" type="text" name="to"
          value="${escapeHtml(filters.dateToDisplay ?? "")}"
          placeholder="dd/mm/yy"
          autocomplete="off"
          maxlength="8" />
        ${filters.dateToError ? `<span class="filter-error">${escapeHtml(filters.dateToError)}</span>` : ""}
      </div>
      <div class="filter-field">
        <span class="filter-field-label">לקוח</span>
        <input class="filter-input filter-input-wide" type="text" name="customer"
          value="${escapeHtml(filters.customer ?? "")}"
          placeholder="שם לקוח"
          list="customer-autocomplete"
          autocomplete="off" />
        <datalist id="customer-autocomplete">
          ${customerNames.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("")}
        </datalist>
      </div>
      <div class="filter-field">
        <span class="filter-field-label">סטטוס</span>
        <select class="filter-select" name="status">
          <option value="">הכל</option>
          ${PAYMENT_STATUSES.map(
            (s) =>
              `<option value="${s}"${filters.status === s ? " selected" : ""}>${PAYMENT_STATUS_LABELS[s]}</option>`
          ).join("")}
        </select>
      </div>
      ${filters.sortBy !== "created_at" ? `<input type="hidden" name="sort" value="${filters.sortBy}" />` : ""}
      ${filters.sortDir !== "desc" ? `<input type="hidden" name="dir" value="${filters.sortDir}" />` : ""}
      <div class="filter-actions">
        <button type="submit" class="btn btn-primary btn-sm">סינון</button>
        ${hasActiveFilters(filters) ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(clearSortUrl)}">נקה</a>` : ""}
      </div>
    </form>`;
}

function renderFilterChips(filters: ParsedFilters): string {
  const chips = buildChips(BASE_PATH, filters, getPaymentStatusLabel);
  if (chips.length === 0) return "";

  const clearAllUrl = buildFilterUrl(BASE_PATH, {
    sortBy: filters.sortBy,
    sortDir: filters.sortDir
  });

  return `
    <div class="chips-row">
      ${chips
        .map(
          (chip) => `
        <span class="chip">
          ${escapeHtml(chip.label)}
          <a class="chip-x" href="${escapeHtml(chip.removeUrl)}" title="הסר">×</a>
        </span>`
        )
        .join("")}
      ${chips.length > 1 ? `<a class="chips-clear" href="${escapeHtml(clearAllUrl)}">נקה הכל</a>` : ""}
    </div>`;
}

function renderSortTh(
  label: string,
  field: SortField,
  filters: ParsedFilters
): string {
  const isActive = filters.sortBy === field;
  const url = buildSortUrl(BASE_PATH, filters, field);
  const arrow = isActive
    ? `<span class="sort-arrow">${filters.sortDir === "desc" ? "↓" : "↑"}</span>`
    : "";
  return `<th><a class="sort-link${isActive ? " active" : ""}" href="${escapeHtml(url)}">${label}${arrow}</a></th>`;
}

function renderLayout(input: {
  appConfig: AppConfig;
  title: string;
  activePath: "dashboard" | "new-payment" | "payments";
  content: string;
}) {
  const navItems = [
    {
      key: "dashboard",
      href: "/",
      label: "דשבורד",
      icon: `<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`
    },
    {
      key: "new-payment",
      href: "/admin/payments/new",
      label: "בקשת תשלום",
      icon: `<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/></svg>`
    },
    {
      key: "payments",
      href: "/admin/payments",
      label: "עסקאות",
      icon: `<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><line x1="1.5" y1="6.5" x2="14.5" y2="6.5"/></svg>`
    }
  ] as const;

  const envInfo: string[] = [];
  if (input.appConfig.appEnv !== "production") {
    envInfo.push(`סביבה: ${getEnvironmentLabel(input.appConfig.appEnv)}`);
  }
  if (input.appConfig.growMode === "mock") {
    envInfo.push("מצב תשלום: דמו");
  }

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} — נמרודי ושות׳</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-top">
        <span class="brand-eyebrow">נמרודי ושות׳</span>
        <h1 class="brand-name">מערכת תשלומים</h1>
      </div>
      <nav class="sidebar-nav">
        ${navItems
          .map(
            (item) => `
          <a href="${item.href}" class="nav-link${input.activePath === item.key ? " active" : ""}">
            ${item.icon}
            ${item.label}
          </a>`
          )
          .join("")}
      </nav>
      <div class="sidebar-footer">
        ${envInfo.length > 0 ? `<div class="sidebar-env">${escapeHtml(envInfo.join(" · "))}</div>` : ""}
        <form method="post" action="/logout">
          <button type="submit" class="btn btn-ghost" style="width:100%;justify-content:flex-start;font-size:0.8rem;color:#6b7280;min-height:34px;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 12H2.5A1.5 1.5 0 0 1 1 10.5v-5A1.5 1.5 0 0 1 2.5 4H6"/><polyline points="10 12 14 8 10 4"/><line x1="14" y1="8" x2="5" y2="8"/></svg>
            התנתקות
          </button>
        </form>
        <div style="padding:8px 8px 0;font-size:0.7rem;color:#374151;letter-spacing:0.04em;">${APP_VERSION}</div>
      </div>
    </aside>
    <main>
      <header class="topbar">
        <h2 class="page-title">${escapeHtml(input.title)}</h2>
        <div class="topbar-right">
          ${input.appConfig.appEnv !== "production" && input.appConfig.growMode === "mock" ? `<span class="env-badge">סביבת הדגמה</span>` : ""}
          <a href="/admin/settings/client-requirements" class="btn btn-ghost btn-sm" style="color:var(--ink-faint);">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5.5" x2="8" y2="8.5"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/></svg>
            מערכת
          </a>
        </div>
      </header>
      <div class="page-content">
        ${input.content}
      </div>
    </main>
  </div>
  <script>${SHARED_JS}</script>
</body>
</html>`;
}

function getStatusBadgeClass(status: Payment["status"]) {
  if (status === "paid") return "badge badge-success";
  if (status === "failed" || status === "cancelled" || status === "expired")
    return "badge badge-danger";
  if (status === "pending" || status === "payment_created")
    return "badge badge-warning";
  return "badge badge-neutral";
}

function renderBreakdown(metrics: DashboardMetrics) {
  const visibleItems = metrics.statusBreakdown.filter((item) => item.count > 0);
  if (visibleItems.length === 0) {
    return `<div class="empty">לאחר יצירת עסקאות יופיע כאן פירוט לפי סטטוסים.</div>`;
  }
  const maxCount = Math.max(1, ...visibleItems.map((item) => item.count));
  return `
    <div class="breakdown-list">
      ${visibleItems
        .map(
          (item) => `
        <a class="breakdown-row" href="${BASE_PATH}?status=${item.status}">
          <div class="breakdown-meta">
            <span class="b-label">${item.label}</span>
            <span class="b-count">${item.count}</span>
          </div>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width:${Math.round((item.count / maxCount) * 100)}%"></div>
          </div>
        </a>`
        )
        .join("")}
    </div>`;
}

function renderTimeline(payment: Payment) {
  const items = [
    ["נוצרה", payment.createdAt],
    ["עודכנה", payment.updatedAt],
    ["שולמה", payment.paidAt],
    ["בוטלה", payment.cancelledAt],
    ["נכשלה", payment.failedAt]
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  if (items.length === 0)
    return `<div class="empty">עדיין אין תאריכים להצגה.</div>`;

  return `
    <div class="timeline">
      ${items
        .map(
          ([label, value]) => `
        <div class="timeline-item">
          <span class="t-label">${label}</span>
          <span class="t-value">${formatDateTime(value)}</span>
        </div>`
        )
        .join("")}
    </div>`;
}

function renderWebhookRecords(webhooks: PaymentWebhookRecord[]) {
  if (webhooks.length === 0) {
    return `<div class="empty">עדיין לא נשמרו אירועי webhook לעסקה זו.</div>`;
  }

  return `
    <div class="tech-list">
      ${webhooks
        .map(
          (wh) => `
        <div class="tech-item">
          <div class="btn-row" style="margin-bottom:10px;">
            <span class="badge badge-default">${escapeHtml(getWebhookEventLabel(wh.eventType))}</span>
            <span class="${
              wh.processingStatus === "processed"
                ? "badge badge-success"
                : wh.processingStatus === "failed"
                  ? "badge badge-danger"
                  : "badge badge-neutral"
            }">${escapeHtml(getWebhookProcessingStatusLabel(wh.processingStatus))}</span>
          </div>
          <div class="tech-grid">
            <div class="tech-field"><strong>התקבל</strong><span>${formatDateTime(wh.receivedAt)}</span></div>
            <div class="tech-field"><strong>עודכן</strong><span>${formatDateTime(wh.processedAt)}</span></div>
            <div class="tech-field"><strong>מזהה אירוע</strong><span>${escapeHtml(wh.providerEventId ?? "—")}</span></div>
            <div class="tech-field"><strong>מזהה עסקה</strong><span>${escapeHtml(wh.providerTransactionId ?? "—")}</span></div>
          </div>
          ${wh.processingError ? `<div class="alert alert-danger" style="margin-top:10px;">${escapeHtml(wh.processingError)}</div>` : ""}
        </div>`
        )
        .join("")}
    </div>`;
}

function renderSimulatorButtons(payment: Payment, redirectPath: string) {
  const statuses = [
    { eventType: "payment.paid", status: "paid", label: "סימון כשולם" },
    { eventType: "payment.failed", status: "failed", label: "נכשל" },
    { eventType: "payment.cancelled", status: "cancelled", label: "בוטל" },
    { eventType: "payment.expired", status: "expired", label: "פג תוקף" }
  ] as const;

  return `
    <div class="btn-row">
      ${statuses
        .map(
          ({ eventType, status, label }) => `
        <form method="post" data-mock-webhook-form data-redirect="${escapeHtml(redirectPath)}">
          <input type="hidden" name="event_id" value="mock_evt_${escapeHtml(payment.id)}_${status}" />
          <input type="hidden" name="event_type" value="${eventType}" />
          <input type="hidden" name="provider" value="mock_grow" />
          <input type="hidden" name="provider_payment_id" value="${escapeHtml(payment.providerPaymentId ?? "")}" />
          <input type="hidden" name="provider_transaction_id" value="${escapeHtml(payment.providerTransactionId ?? "")}" />
          <input type="hidden" name="status" value="${status}" />
          <input type="hidden" name="amount_agorot" value="${payment.amountAgorot}" />
          <input type="hidden" name="currency" value="${escapeHtml(payment.currency)}" />
          <button type="submit" class="btn btn-secondary btn-sm">${label}</button>
        </form>`
        )
        .join("")}
    </div>`;
}

function renderSimulatorForms(payment: Payment, redirectPath: string) {
  if (isFinalPaymentStatus(payment.status)) {
    return `
      <div class="alert alert-info" style="margin-bottom:12px;">
        העסקה הסתיימה. ניתן עדיין להפעיל אירוע דמו חוזר לצורך בדיקה.
      </div>
      ${renderSimulatorButtons(payment, redirectPath)}`;
  }
  return renderSimulatorButtons(payment, redirectPath);
}

function renderInvoiceSection(input: {
  payment: Payment;
  invoice: InvoiceRecord | null;
}) {
  if (!input.invoice) {
    return `
      <div class="summary-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
        <div class="summary-cell">
          <strong>מצב מסמך</strong>
          <span>${input.payment.status === "paid" ? "המערכת תנסה להפיק מסמך בקרוב." : "המסמך יופיע לאחר אישור התשלום."}</span>
        </div>
        <div class="summary-cell">
          <strong>קישור למסמך</strong>
          <span style="color:var(--ink-faint)">עדיין לא זמין</span>
        </div>
      </div>
      ${
        input.payment.status === "paid"
          ? `
        <div class="btn-row" style="margin-top:14px;">
          <form method="post" data-mock-invoice-form data-endpoint="/api/payments/${escapeHtml(input.payment.id)}/invoice/mock" data-redirect="/admin/payments/${escapeHtml(input.payment.id)}">
            <button type="submit" class="btn btn-secondary btn-sm">יצירת מסמך דמו</button>
          </form>
        </div>`
          : ""
      }`;
  }

  const canRetry =
    input.payment.status === "paid" &&
    (input.invoice.status === "failed" || input.invoice.status === "pending");

  return `
    <div class="summary-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
      <div class="summary-cell">
        <strong>מצב מסמך</strong>
        <span>${getInvoiceDisplayState(input.invoice)}</span>
      </div>
      <div class="summary-cell">
        <strong>מספר מסמך</strong>
        <span>${escapeHtml(input.invoice.invoiceNumber ?? "—")}</span>
      </div>
    </div>
    ${
      input.invoice.invoiceUrl
        ? `
      <div class="btn-row" style="margin-top:14px;">
        <a class="btn btn-secondary btn-sm" href="${escapeHtml(input.invoice.invoiceUrl)}" target="_blank" rel="noreferrer">פתיחת מסמך דמו</a>
      </div>`
        : ""
    }
    <div class="alert alert-info" style="margin-top:12px;">המסמך המוצג מיועד להדגמה בלבד.</div>
    ${
      canRetry
        ? `
      <div class="btn-row" style="margin-top:10px;">
        <form method="post" data-mock-invoice-form data-endpoint="/api/payments/${escapeHtml(input.payment.id)}/invoice/mock" data-redirect="/admin/payments/${escapeHtml(input.payment.id)}">
          <button type="submit" class="btn btn-secondary btn-sm">ניסיון נוסף ליצירת מסמך</button>
        </form>
      </div>`
        : ""
    }`;
}

function renderDashboardRows(items: PaymentListItemView[]) {
  if (items.length === 0) {
    return `<tr><td colspan="5"><div class="empty">עדיין אין עסקאות במערכת.</div></td></tr>`;
  }

  return items
    .slice(0, 8)
    .map(
      ({ payment, invoice }) => `
    <tr onclick="window.location='/admin/payments/${payment.id}'">
      <td>
        <div class="cell-primary">${escapeHtml(payment.customerName)}</div>
        <div class="cell-secondary">${escapeHtml(payment.description)}</div>
      </td>
      <td class="amount-strong">${formatAmountAgorot(payment.amountAgorot)}</td>
      <td><span class="${getStatusBadgeClass(payment.status)}">${getPaymentStatusLabel(payment.status)}</span></td>
      <td>${
        invoice?.invoiceUrl
          ? `<a href="${escapeHtml(invoice.invoiceUrl)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">מסמך</a>`
          : payment.invoiceId
            ? `<span style="color:var(--ink-faint);font-size:0.8rem">נוצר</span>`
            : `<span style="color:var(--ink-faint);font-size:0.8rem">—</span>`
      }</td>
      <td style="color:var(--ink-faint);font-size:0.8rem;">${formatDateTime(payment.createdAt)}</td>
    </tr>`
    )
    .join("");
}

function renderPaymentRows(items: PaymentListItemView[]) {
  if (items.length === 0) {
    return `<tr><td colspan="7"><div class="empty">עדיין לא נוצרו בקשות תשלום.</div></td></tr>`;
  }

  return items
    .map(
      ({ payment, invoice }) => `
    <tr onclick="window.location='/admin/payments/${payment.id}'">
      <td style="color:var(--ink-faint);font-size:0.8rem;white-space:nowrap;">${formatDateTime(payment.createdAt)}</td>
      <td>
        <div class="cell-primary">${escapeHtml(payment.customerName)}</div>
        <div class="cell-secondary">${escapeHtml(payment.description)}</div>
      </td>
      <td style="font-size:0.8rem;color:var(--ink-soft);">
        ${escapeHtml(payment.customerPhone ?? "—")}<br/>
        <span style="color:var(--ink-faint);">${escapeHtml(payment.customerEmail ?? "—")}</span>
      </td>
      <td class="amount-strong">${formatAmountAgorot(payment.amountAgorot)}</td>
      <td><span class="${getStatusBadgeClass(payment.status)}">${getPaymentStatusLabel(payment.status)}</span></td>
      <td>${
        invoice?.invoiceUrl
          ? `<a href="${escapeHtml(invoice.invoiceUrl)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">מסמך</a>`
          : payment.invoiceId
            ? `<span style="color:var(--ink-faint);font-size:0.8rem">נוצר</span>`
            : `<span style="color:var(--ink-faint);font-size:0.8rem">—</span>`
      }</td>
      <td>
        ${
          payment.paymentUrl
            ? `<a href="${escapeHtml(payment.paymentUrl)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()" style="font-size:0.8rem;">קישור</a>`
            : `<span style="color:var(--ink-faint);font-size:0.8rem">—</span>`
        }
      </td>
    </tr>`
    )
    .join("");
}

export function renderLoginPage(input: {
  appConfig: AppConfig;
  errorMessage?: string | null;
  nextPath?: string;
}) {
  const nextPath = input.nextPath?.startsWith("/") ? input.nextPath : "/";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>כניסה — נמרודי ושות׳</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: "Noto Sans Hebrew", "Segoe UI", system-ui, sans-serif;
      background: #f0f2f5;
      color: #0d1b2a;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      width: min(440px, 100%);
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    .eyebrow {
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #8896a8;
      margin: 0 0 10px;
      display: block;
    }
    h1 { font-size: 1.5rem; font-weight: 700; color: #0d1b2a; margin: 0 0 8px; }
    p { color: #4a5568; font-size: 0.875rem; line-height: 1.65; margin: 0 0 24px; }
    label {
      display: grid;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 18px;
    }
    input {
      width: 100%;
      padding: 10px 13px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      font: inherit;
      font-size: 0.9rem;
      color: #0d1b2a;
      background: #fff;
      transition: border-color 150ms, box-shadow 150ms;
    }
    input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
    button {
      width: 100%;
      min-height: 42px;
      border: none;
      border-radius: 8px;
      background: #1e3a5f;
      color: #fff;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms, transform 150ms;
    }
    button:hover { background: #162d4a; transform: translateY(-1px); }
    .error { margin-top: 14px; padding: 10px 14px; border-radius: 8px; background: #fee2e2; color: #b91c1c; font-size: 0.875rem; border: 1px solid rgba(185,28,28,0.15); }
    .note { margin-top: 14px; padding: 10px 14px; border-radius: 8px; background: #e8eef6; color: #1e3a5f; font-size: 0.875rem; border: 1px solid rgba(30,58,95,0.12); }
  </style>
</head>
<body>
  <section class="card">
    <span class="eyebrow">נמרודי ושות׳ — רואי חשבון</span>
    <h1>כניסה למערכת</h1>
    <p>אזור זה מיועד לשימוש ניהולי בלבד.</p>
    ${input.errorMessage ? `<div class="error">${escapeHtml(input.errorMessage)}</div>` : ""}
    ${input.appConfig.appEnv !== "production" ? `<div class="note">המערכת זמינה כעת בסביבת ${escapeHtml(getEnvironmentLabel(input.appConfig.appEnv))}.</div>` : ""}
    <form method="post" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(nextPath)}" />
      <label>
        סיסמת ניהול
        <input type="password" name="password" autocomplete="current-password" required />
      </label>
      <button type="submit">כניסה</button>
    </form>
  </section>
</body>
</html>`;
}

export function renderDashboardPage(input: {
  appConfig: AppConfig;
  payments: PaymentListItemView[];
  metrics: DashboardMetrics;
}) {
  return renderLayout({
    appConfig: input.appConfig,
    title: "דשבורד",
    activePath: "dashboard",
    content: `
      <p class="section-label">סקירה כללית</p>

      <div class="kpi-row">
        <a class="kpi-card" href="${BASE_PATH}">
          <span class="kpi-label">סך בקשות</span>
          <span class="kpi-value">${input.metrics.totalRequests}</span>
          <span class="kpi-sub">כלל העסקאות שנוצרו</span>
        </a>
        <a class="kpi-card" href="${BASE_PATH}?status=paid">
          <span class="kpi-label">שולמו</span>
          <span class="kpi-value success">${input.metrics.paidCount}</span>
          <span class="kpi-sub">עסקאות שאושרו</span>
        </a>
        <a class="kpi-card" href="${BASE_PATH}">
          <span class="kpi-label">ממתינות</span>
          <span class="kpi-value">${input.metrics.pendingCount}</span>
          <span class="kpi-sub">פתוחות לתשלום</span>
        </a>
        <div class="kpi-card">
          <span class="kpi-label">סכום שנגבה</span>
          <span class="kpi-value accent" style="font-size:1.5rem;">${formatAmountAgorot(input.metrics.paidAmountAgorot)}</span>
          <span class="kpi-sub">ממתין: ${formatAmountAgorot(input.metrics.pendingAmountAgorot)}</span>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h3>עסקאות אחרונות</h3>
            <a class="btn btn-secondary btn-sm" href="/admin/payments">לכל העסקאות</a>
          </div>
          <table class="recent-table">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>סכום</th>
                <th>סטטוס</th>
                <th>מסמך</th>
                <th>תאריך</th>
              </tr>
            </thead>
            <tbody>${renderDashboardRows(input.payments)}</tbody>
          </table>
        </div>

        <div class="dashboard-sidebar-stack">
          <div class="card">
            <div class="card-header">
              <h3>התפלגות סטטוסים</h3>
            </div>
            ${renderBreakdown(input.metrics)}
          </div>

          <div class="card">
            <div class="card-header">
              <h3>פעולות מהירות</h3>
            </div>
            <div class="quick-links">
              <a class="quick-link" href="/admin/payments/new">
                <span>יצירת בקשת תשלום</span>
                <span class="quick-link-arrow">‹</span>
              </a>
              <a class="quick-link" href="/admin/payments">
                <span>רשימת עסקאות</span>
                <span class="quick-link-arrow">‹</span>
              </a>
              <a class="quick-link" href="/admin/payments/export.csv">
                <span>ייצוא CSV</span>
                <span class="quick-link-arrow">‹</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `
  });
}

export function renderNewPaymentPage(input: {
  appConfig: AppConfig;
  errorMessage?: string | null;
  formValues?: Record<string, string>;
}) {
  const values = input.formValues ?? {};

  return renderLayout({
    appConfig: input.appConfig,
    title: "בקשת תשלום חדשה",
    activePath: "new-payment",
    content: `
      <div class="form-shell">
        <p class="section-label">פרטי הבקשה</p>
        <div class="card">
          ${input.errorMessage ? `<div class="alert alert-danger" style="margin-bottom:18px;">${escapeHtml(input.errorMessage)}</div>` : ""}
          <form id="payment-form" class="form-grid" method="post" action="/api/payments">
            <div class="form-grid-2">
              <label>
                שם הלקוח
                <input name="customer_name" required value="${escapeHtml(values.customer_name ?? "")}" placeholder="שם מלא" />
              </label>
              <label>
                טלפון
                <input name="customer_phone" value="${escapeHtml(values.customer_phone ?? "")}" placeholder="0501234567" />
              </label>
            </div>
            <div class="form-grid-2">
              <label>
                אימייל
                <input name="customer_email" type="email" value="${escapeHtml(values.customer_email ?? "")}" placeholder="client@example.com" />
              </label>
              <label>
                סכום בשקלים
                <input name="amount_shekel" type="number" step="0.01" min="0.01" required value="${escapeHtml(values.amount_shekel ?? "")}" placeholder="1,250.00" />
              </label>
            </div>
            <label>
              תיאור הבקשה
              <textarea name="description" required placeholder="שכר טרחה עבור דוח שנתי">${escapeHtml(values.description ?? "")}</textarea>
            </label>
            <div class="btn-row" style="margin-top:4px;">
              <button type="submit" class="btn btn-primary">יצירת בקשה</button>
              <a class="btn btn-secondary" href="/admin/payments">ביטול</a>
            </div>
          </form>
        </div>
        <div class="alert alert-info" style="margin-top:14px;">
          הסכום מוזן בשקלים — המערכת ממירה לאגורות ברקע.
        </div>
      </div>
      <script>
        const form = document.getElementById("payment-form");
        if (form instanceof HTMLFormElement) {
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());
            try {
              const response = await fetch("/api/payments", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload)
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error || "לא ניתן היה ליצור בקשת תשלום.");
              window.location.href = "/admin/payments/" + data.payment.id;
            } catch (error) {
              const message = error instanceof Error ? error.message : "לא ניתן היה ליצור בקשת תשלום.";
              window.location.href = "/admin/payments/new?error=" + encodeURIComponent(message)
                + "&customer_name=" + encodeURIComponent(String(payload.customer_name || ""))
                + "&customer_phone=" + encodeURIComponent(String(payload.customer_phone || ""))
                + "&customer_email=" + encodeURIComponent(String(payload.customer_email || ""))
                + "&amount_shekel=" + encodeURIComponent(String(payload.amount_shekel || ""))
                + "&description=" + encodeURIComponent(String(payload.description || ""));
            }
          });
        }
      </script>
    `
  });
}

export function renderPaymentsListPage(input: {
  appConfig: AppConfig;
  payments: PaymentListResult;
  invoiceByPaymentId: Record<string, InvoiceRecord | null>;
  filters: ParsedFilters;
  customerNames: string[];
}) {
  const previousOffset = Math.max(
    0,
    input.payments.offset - input.payments.limit
  );
  const nextOffset = input.payments.offset + input.payments.limit;
  const prevUrl = buildFilterUrl(BASE_PATH, input.filters, {
    limit: input.payments.limit,
    offset: previousOffset
  });
  const nextUrl = buildFilterUrl(BASE_PATH, input.filters, {
    limit: input.payments.limit,
    offset: nextOffset
  });
  const activeCount = hasActiveFilters(input.filters);

  return renderLayout({
    appConfig: input.appConfig,
    title: "עסקאות",
    activePath: "payments",
    content: `
      <div class="card">
        <div class="card-header">
          <h3>כל הבקשות${activeCount ? " · מסוננות" : ""}</h3>
          <div class="btn-row">
            <a class="btn btn-secondary btn-sm" href="/admin/payments/export.csv">ייצוא CSV</a>
            <a class="btn btn-primary btn-sm" href="/admin/payments/new">בקשה חדשה</a>
          </div>
        </div>
        ${renderFilterBar(input.filters, input.customerNames)}
        ${renderFilterChips(input.filters)}
        <table class="data-table">
          <thead>
            <tr>
              ${renderSortTh("תאריך", "created_at", input.filters)}
              ${renderSortTh("לקוח", "customer_name", input.filters)}
              <th>פרטי קשר</th>
              ${renderSortTh("סכום", "amount_agorot", input.filters)}
              ${renderSortTh("סטטוס", "status", input.filters)}
              <th>מסמך</th>
              <th>קישור</th>
            </tr>
          </thead>
          <tbody>${renderPaymentRows(
            input.payments.items.map((payment) => ({
              payment,
              invoice: input.invoiceByPaymentId[payment.id] ?? null
            }))
          )}</tbody>
        </table>
        ${
          input.payments.offset > 0 || input.payments.hasMore
            ? `
          <div class="pagination">
            ${input.payments.offset > 0 ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(prevUrl)}">עמוד קודם</a>` : ""}
            ${input.payments.hasMore ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(nextUrl)}">עמוד הבא</a>` : ""}
          </div>`
            : ""
        }
      </div>
    `
  });
}

export function renderPaymentDetailsPage(input: {
  appConfig: AppConfig;
  payment: Payment;
  invoice: InvoiceRecord | null;
  webhooks: PaymentWebhookRecord[];
  simulatorMessage?: string | null;
  simulatorOutcome?: string | null;
  invoiceMessage?: string | null;
  invoiceOutcome?: string | null;
}) {
  const whatsappLink = buildWhatsAppLink({
    customerName: input.payment.customerName,
    customerPhone: input.payment.customerPhone,
    description: input.payment.description,
    amountAgorot: input.payment.amountAgorot,
    paymentUrl: input.payment.paymentUrl
  });

  const simulatorAlert = input.simulatorMessage
    ? `<div class="alert ${input.simulatorOutcome === "failed" ? "alert-danger" : input.simulatorOutcome === "duplicate" ? "alert-warning" : "alert-success"}" style="margin-bottom:16px;">${escapeHtml(input.simulatorMessage)}</div>`
    : "";

  const invoiceAlert = input.invoiceMessage
    ? `<div class="alert ${input.invoiceOutcome === "failed" ? "alert-danger" : input.invoiceOutcome === "existing" ? "alert-warning" : "alert-success"}" style="margin-bottom:16px;">${escapeHtml(input.invoiceMessage)}</div>`
    : "";

  return renderLayout({
    appConfig: input.appConfig,
    title: "פרטי עסקה",
    activePath: "payments",
    content: `
      ${simulatorAlert}${invoiceAlert}

      <div class="card" style="margin-bottom:20px;">
        <div class="detail-header">
          <div>
            <h2 class="detail-customer">${escapeHtml(input.payment.customerName)}</h2>
            <p class="detail-desc">${escapeHtml(input.payment.description)}</p>
          </div>
          <div class="detail-status-block">
            <div class="detail-amount">${formatAmountAgorot(input.payment.amountAgorot)}</div>
            <span class="${getStatusBadgeClass(input.payment.status)}">${getPaymentStatusLabel(input.payment.status)}</span>
          </div>
        </div>

        <p class="section-label" style="margin-bottom:10px;">פרטי לקוח</p>
        <div class="summary-grid">
          <div class="summary-cell">
            <strong>שם לקוח</strong>
            <span>${escapeHtml(input.payment.customerName)}</span>
          </div>
          <div class="summary-cell">
            <strong>טלפון</strong>
            <span>${escapeHtml(input.payment.customerPhone ?? "—")}</span>
          </div>
          <div class="summary-cell">
            <strong>אימייל</strong>
            <span>${escapeHtml(input.payment.customerEmail ?? "—")}</span>
          </div>
        </div>

        <p class="section-label" style="margin-top:20px;margin-bottom:10px;">קישור תשלום</p>
        <div class="inline-code">${escapeHtml(input.payment.paymentUrl ?? "קישור התשלום עדיין לא זמין")}</div>
        <div class="btn-row">
          ${
            input.payment.paymentUrl
              ? `
            <span class="copy-anchor">
              <button type="button" class="btn btn-primary" data-copy-text="${escapeHtml(input.payment.paymentUrl)}" data-copy-feedback="copy-feedback">העתקת קישור</button>
              <span id="copy-feedback" class="copy-toast" aria-live="polite"></span>
            </span>
            <a class="btn btn-secondary" href="${escapeHtml(input.payment.paymentUrl)}" target="_blank" rel="noreferrer">פתיחת קישור</a>`
              : ""
          }
          ${whatsappLink ? `<a class="btn btn-whatsapp" href="${escapeHtml(whatsappLink)}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""}
          <a class="btn btn-secondary" href="/admin/payments">חזרה לרשימה</a>
        </div>
      </div>

      <div class="split-grid">
        <div class="card">
          <div class="card-header"><h3>מסמך</h3></div>
          ${renderInvoiceSection({ payment: input.payment, invoice: input.invoice })}
        </div>

        <div class="card">
          <div class="card-header"><h3>ציר זמן</h3></div>
          ${renderTimeline(input.payment)}
        </div>
      </div>

      <div class="card">
        <details class="disclosure">
          <summary>פרטים טכניים</summary>
          <div class="disclosure-body">
            <div class="tech-grid" style="margin-top:4px;">
              <div class="tech-field"><strong>מזהה תשלום</strong><span>${escapeHtml(input.payment.id)}</span></div>
              <div class="tech-field"><strong>ספק</strong><span>${escapeHtml(getProviderLabel(input.payment.provider))}</span></div>
              <div class="tech-field"><strong>מזהה ספק</strong><span>${escapeHtml(input.payment.providerPaymentId ?? "—")}</span></div>
              <div class="tech-field"><strong>מזהה עסקה</strong><span>${escapeHtml(input.payment.providerTransactionId ?? "—")}</span></div>
              <div class="tech-field"><strong>מזהה מסמך</strong><span>${escapeHtml(input.payment.invoiceId ?? "—")}</span></div>
              <div class="tech-field"><strong>סטטוס פנימי</strong><span>${escapeHtml(input.payment.status)}</span></div>
            </div>
            <details class="disclosure" style="margin-top:4px;">
              <summary>אירועי Webhook</summary>
              <div class="disclosure-body">
                ${renderWebhookRecords(input.webhooks)}
              </div>
            </details>
          </div>
        </details>

        ${
          input.appConfig.enableDevTools
            ? `
          <details class="disclosure" style="margin-top:12px;">
            <summary>כלי הדגמה</summary>
            <div class="disclosure-body">
              <div class="alert alert-info">
                פעולות אלו נועדו להדגמה מבוקרת של מעבר בין מצבי תשלום ויצירת מסמך דמו.
              </div>
              ${renderSimulatorForms(input.payment, `/admin/payments/${input.payment.id}`)}
            </div>
          </details>`
            : ""
        }
      </div>
    `
  });
}

export function renderMockGrowPaymentPage(input: {
  appConfig: AppConfig;
  payment: Payment;
  webhooks: PaymentWebhookRecord[];
}) {
  return renderLayout({
    appConfig: input.appConfig,
    title: "עמוד תשלום דמו",
    activePath: "payments",
    content: `
      <div class="card" style="margin-bottom:20px;">
        <p class="section-label">הדגמת תשלום</p>
        <div class="summary-grid">
          <div class="summary-cell">
            <strong>לקוח</strong>
            <span>${escapeHtml(input.payment.customerName)}</span>
          </div>
          <div class="summary-cell">
            <strong>סכום</strong>
            <span>${formatAmountAgorot(input.payment.amountAgorot)}</span>
          </div>
          <div class="summary-cell">
            <strong>סטטוס</strong>
            <span><span class="${getStatusBadgeClass(input.payment.status)}">${getPaymentStatusLabel(input.payment.status)}</span></span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><h3>פעולות הדגמה</h3></div>
        <p style="color:var(--ink-soft);font-size:0.875rem;margin-bottom:14px;">בחירת תוצאה מדגימה את עדכון הסטטוס במסך העסקה.</p>
        ${renderSimulatorForms(input.payment, `/dev/mock-grow/pay/${input.payment.providerPaymentId ?? ""}`)}
      </div>

      <div class="card">
        <details class="disclosure">
          <summary>אירועי Webhook שנשמרו</summary>
          <div class="disclosure-body">
            ${renderWebhookRecords(input.webhooks)}
          </div>
        </details>
        <div class="btn-row" style="margin-top:14px;">
          <a class="btn btn-secondary" href="/admin/payments/${input.payment.id}">חזרה לפרטי העסקה</a>
        </div>
      </div>
    `
  });
}

export function renderMockInvoicePage(input: {
  appConfig: AppConfig;
  invoice: InvoiceRecord;
  payment: Payment;
}) {
  return renderLayout({
    appConfig: input.appConfig,
    title: "מסמך דמו",
    activePath: "payments",
    content: `
      <div class="card">
        <p class="section-label">מסמך לצפייה בלבד</p>
        <div class="summary-grid">
          <div class="summary-cell">
            <strong>לקוח</strong>
            <span>${escapeHtml(input.payment.customerName)}</span>
          </div>
          <div class="summary-cell">
            <strong>סכום</strong>
            <span>${formatAmountAgorot(input.payment.amountAgorot)}</span>
          </div>
          <div class="summary-cell">
            <strong>סטטוס מסמך</strong>
            <span>${getInvoiceStatusLabel(input.invoice.status)}</span>
          </div>
          <div class="summary-cell">
            <strong>תיאור</strong>
            <span>${escapeHtml(input.payment.description)}</span>
          </div>
          <div class="summary-cell">
            <strong>נוצר</strong>
            <span>${formatDateTime(input.invoice.createdAt)}</span>
          </div>
          <div class="summary-cell">
            <strong>עודכן</strong>
            <span>${formatDateTime(input.invoice.updatedAt)}</span>
          </div>
        </div>
        <div class="alert alert-info" style="margin-top:16px;">המסמך המוצג מיועד להדגמה בלבד ואינו מסמך חשבונאי או משפטי.</div>
        <details class="disclosure" style="margin-top:14px;">
          <summary>פרטים טכניים</summary>
          <div class="disclosure-body">
            <div class="tech-grid" style="margin-top:4px;">
              <div class="tech-field"><strong>מזהה תשלום</strong><span>${escapeHtml(input.payment.id)}</span></div>
              <div class="tech-field"><strong>מזהה מסמך ספק</strong><span>${escapeHtml(input.invoice.providerInvoiceId ?? "—")}</span></div>
            </div>
          </div>
        </details>
        <div class="btn-row" style="margin-top:16px;">
          <a class="btn btn-secondary" href="/admin/payments/${escapeHtml(input.payment.id)}">חזרה לפרטי העסקה</a>
        </div>
      </div>
    `
  });
}

export function renderClientRequirementsPage(input: { appConfig: AppConfig }) {
  return renderLayout({
    appConfig: input.appConfig,
    title: "סטטוס מערכת",
    activePath: "dashboard",
    content: `
      <div class="split-grid">
        <div class="card">
          <div class="card-header"><h3>תצורת הסביבה</h3></div>
          <div class="summary-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
            <div class="summary-cell">
              <strong>סביבה</strong>
              <span>${escapeHtml(getEnvironmentLabel(input.appConfig.appEnv))}</span>
            </div>
            <div class="summary-cell">
              <strong>מצב תשלום</strong>
              <span>${escapeHtml(getGrowModeLabel(input.appConfig))}</span>
            </div>
            <div class="summary-cell">
              <strong>מצב מסמכים</strong>
              <span>${input.appConfig.invoiceMode === "mock" ? "דמו" : escapeHtml(input.appConfig.invoiceMode)}</span>
            </div>
          </div>
          <div class="alert alert-info" style="margin-top:16px;">
            בסביבת הדגמה הלקוח רואה את המערכת המלאה ללא חיבור לשירותים חיצוניים.
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>פעולות</h3></div>
          <div class="quick-links">
            <a class="quick-link" href="/admin/payments/export.csv">
              <span>ייצוא נתונים</span>
              <span class="quick-link-arrow">‹</span>
            </a>
            <a class="quick-link" href="/admin/payments/new">
              <span>בקשה חדשה</span>
              <span class="quick-link-arrow">‹</span>
            </a>
            <a class="quick-link" href="/admin/payments">
              <span>מעקב עסקאות</span>
              <span class="quick-link-arrow">‹</span>
            </a>
          </div>
        </div>
      </div>
    `
  });
}

export function renderStatusPage(input: {
  appConfig: AppConfig;
  title: string;
  headline: string;
  message: string;
  statusCode: number;
}) {
  return renderLayout({
    appConfig: input.appConfig,
    title: `${input.headline} — נמרודי ושות׳`,
    activePath: "dashboard",
    content: `
      <div class="card status-page">
        <p class="section-label">שגיאה ${input.statusCode}</p>
        <h3 style="margin:0 0 8px;font-size:1.1rem;">${escapeHtml(input.headline)}</h3>
        <p style="color:var(--ink-soft);margin:0 0 20px;line-height:1.65;">${escapeHtml(input.message)}</p>
        <div class="btn-row">
          <a class="btn btn-secondary" href="/">חזרה לדשבורד</a>
          <a class="btn btn-secondary" href="/admin/payments">רשימת עסקאות</a>
        </div>
      </div>
    `
  });
}
