import type { InvoiceRecord } from "../../domain/invoices/invoice-types";
import type { PaymentListResult } from "../../domain/payments/payment-repository";
import { isFinalPaymentStatus } from "../../domain/payments/payment-status";
import type { Payment } from "../../domain/payments/payment-types";
import type { PaymentWebhookRecord } from "../../domain/payments/payment-webhook-types";
import type { AppConfig } from "../../shared/config/app-config";
import { escapeHtml, formatAmountAgorot, formatDateTime } from "./formatters";
import { getInvoiceStatusLabel } from "./invoice-status-labels";
import { getPaymentStatusLabel } from "./status-labels";
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
  if (appEnv === "development") {
    return "פיתוח";
  }

  if (appEnv === "staging") {
    return "בדיקות";
  }

  return "ייצור";
}

function getGrowModeLabel(appConfig: AppConfig) {
  if (appConfig.growMode === "mock") {
    return "דמו";
  }

  if (appConfig.growMode === "sandbox") {
    return "סביבת בדיקות";
  }

  return "ייצור";
}

function getProviderLabel(provider: string) {
  if (provider === "mock-grow" || provider === "mock_grow") {
    return "דמו";
  }

  if (provider === "grow") {
    return "GROW";
  }

  return provider;
}

function getInvoiceDisplayState(invoice: InvoiceRecord | null) {
  if (!invoice) {
    return "טרם נוצר מסמך";
  }

  if (invoice.status === "created") {
    return "מסמך זמין";
  }

  if (invoice.status === "failed") {
    return "נדרשת בדיקה";
  }

  return getInvoiceStatusLabel(invoice.status);
}

function getWebhookProcessingStatusLabel(
  status: PaymentWebhookRecord["processingStatus"]
) {
  if (status === "processed") {
    return "עובד";
  }

  if (status === "failed") {
    return "נכשל";
  }

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

function renderLayout(input: {
  appConfig: AppConfig;
  title: string;
  activePath: "dashboard" | "new-payment" | "payments";
  content: string;
  pageTitle?: string;
}) {
  const navItems = [
    {
      key: "dashboard",
      href: "/",
      label: "לוח בקרה"
    },
    {
      key: "new-payment",
      href: "/admin/payments/new",
      label: "יצירת בקשה"
    },
    {
      key: "payments",
      href: "/admin/payments",
      label: "עסקאות"
    }
  ] as const;

  return `<!DOCTYPE html>
  <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(input.title)}</title>
      <style>
        :root {
          --bg: #f4f2ee;
          --surface: #fffdf8;
          --surface-soft: #f8f5ef;
          --surface-muted: #f1ece3;
          --ink: #162331;
          --ink-soft: #5b6876;
          --ink-faint: #7a8694;
          --line: #ddd6cb;
          --line-strong: #cfc5b8;
          --brand: #23384f;
          --brand-soft: #dfe7ef;
          --brand-deep: #162738;
          --success: #2d6a4f;
          --success-soft: #e5f0e9;
          --warning: #9a6a2e;
          --warning-soft: #f6eddc;
          --danger: #8f3d3d;
          --danger-soft: #f6e5e5;
          --shadow-sm: 0 8px 18px rgba(17, 27, 38, 0.05);
          --shadow-md: 0 18px 40px rgba(17, 27, 38, 0.08);
          --radius-lg: 24px;
          --radius-md: 18px;
          --radius-sm: 14px;
          --font: "Noto Sans Hebrew", "Segoe UI", sans-serif;
        }

        * { box-sizing: border-box; }

        html { scroll-behavior: smooth; }

        body {
          margin: 0;
          min-height: 100vh;
          font-family: var(--font);
          color: var(--ink);
          background:
            radial-gradient(circle at top right, rgba(35, 56, 79, 0.06), transparent 28%),
            linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
        }

        a {
          color: var(--brand);
          text-decoration: none;
        }

        a:hover {
          color: var(--brand-deep);
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        .layout {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
        }

        .sidebar {
          position: sticky;
          top: 0;
          align-self: start;
          min-height: 100vh;
          padding: 28px 24px;
          background: linear-gradient(180deg, #1f3349 0%, #152432 100%);
          color: #f5f2ec;
          border-left: 1px solid rgba(255, 255, 255, 0.07);
        }

        .brand {
          margin-bottom: 26px;
        }

        .brand small {
          display: block;
          margin-bottom: 10px;
          color: rgba(245, 242, 236, 0.72);
          letter-spacing: 0.06em;
          font-size: 0.82rem;
        }

        .brand h1 {
          margin: 0 0 10px;
          font-size: 1.55rem;
          line-height: 1.25;
        }

        .brand p {
          margin: 0;
          color: rgba(245, 242, 236, 0.76);
          line-height: 1.7;
          font-size: 0.96rem;
        }

        nav {
          display: grid;
          gap: 10px;
        }

        nav a {
          display: block;
          padding: 14px 16px;
          border-radius: 14px;
          color: inherit;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
        }

        nav a:hover {
          transform: translateY(-1px);
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        nav a.active {
          background: rgba(223, 231, 239, 0.12);
          border-color: rgba(223, 231, 239, 0.24);
        }

        .sidebar-footnote {
          margin-top: 22px;
          padding: 16px 18px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(245, 242, 236, 0.74);
          line-height: 1.7;
          font-size: 0.93rem;
        }

        main {
          padding: 32px;
        }

        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .page-title {
          margin: 0;
          font-size: 1.95rem;
          line-height: 1.15;
        }

        .page-kicker {
          margin-bottom: 8px;
          color: var(--ink-faint);
          font-size: 0.92rem;
        }

        .topbar-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .meta-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid var(--line);
          color: var(--ink-soft);
          font-size: 0.88rem;
          box-shadow: var(--shadow-sm);
        }

        .context-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(240px, 0.7fr);
          gap: 18px;
          padding: 28px;
          border-radius: 28px;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(247, 243, 235, 0.94));
          border: 1px solid var(--line);
          box-shadow: var(--shadow-md);
          margin-bottom: 24px;
        }

        .hero h2 {
          margin: 0 0 12px;
          font-size: 2rem;
          line-height: 1.15;
        }

        .hero p {
          margin: 0;
          color: var(--ink-soft);
          line-height: 1.8;
          max-width: 60ch;
        }

        .hero-panel {
          padding: 18px 20px;
          border-radius: 20px;
          background: rgba(35, 56, 79, 0.04);
          border: 1px solid rgba(35, 56, 79, 0.08);
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .hero-panel strong {
          font-size: 0.95rem;
        }

        .section-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 24px;
        }

        .split-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 24px;
        }

        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          padding: 24px;
        }

        .card-stack {
          display: grid;
          gap: 24px;
        }

        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .section-head h3 {
          margin: 0;
          font-size: 1.2rem;
        }

        .section-head p {
          margin: 6px 0 0;
          color: var(--ink-soft);
          line-height: 1.7;
          font-size: 0.95rem;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .metric-card {
          padding: 18px;
          border-radius: 20px;
          background: linear-gradient(180deg, #fff 0%, #fbf8f2 100%);
          border: 1px solid var(--line);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .metric-card span {
          display: block;
          color: var(--ink-faint);
          font-size: 0.88rem;
          margin-bottom: 10px;
        }

        .metric-card strong {
          display: block;
          font-size: 1.6rem;
          line-height: 1.1;
          margin-bottom: 6px;
          color: var(--brand-deep);
        }

        .metric-card small {
          color: var(--ink-soft);
          font-size: 0.86rem;
        }

        .breakdown-list {
          display: grid;
          gap: 12px;
        }

        .breakdown-item {
          display: grid;
          gap: 8px;
          padding: 14px 16px;
          border-radius: 16px;
          background: var(--surface-soft);
          border: 1px solid var(--line);
        }

        .breakdown-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--ink);
        }

        .breakdown-bar {
          height: 8px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(35, 56, 79, 0.08);
        }

        .breakdown-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #6a8095 0%, #23384f 100%);
        }

        .quick-actions {
          display: grid;
          gap: 12px;
        }

        .quick-action {
          display: block;
          padding: 18px;
          border-radius: 18px;
          background: var(--surface-soft);
          border: 1px solid var(--line);
          transition: transform 180ms ease, border-color 180ms ease;
        }

        .quick-action:hover {
          transform: translateY(-1px);
          border-color: var(--line-strong);
        }

        .quick-action strong {
          display: block;
          margin-bottom: 6px;
          color: var(--ink);
        }

        .quick-action span {
          color: var(--ink-soft);
          font-size: 0.94rem;
          line-height: 1.65;
        }

        .form-grid {
          display: grid;
          gap: 18px;
        }

        .form-grid.two-columns {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        label {
          display: grid;
          gap: 8px;
          color: var(--ink-soft);
          font-size: 0.95rem;
        }

        input,
        textarea {
          width: 100%;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--ink);
          padding: 13px 14px;
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }

        input:focus,
        textarea:focus {
          outline: none;
          border-color: rgba(35, 56, 79, 0.4);
          box-shadow: 0 0 0 3px rgba(35, 56, 79, 0.08);
        }

        textarea {
          min-height: 120px;
          resize: vertical;
        }

        .button-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 18px;
        }

        .button,
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 46px;
          padding: 0 18px;
          border: 0;
          border-radius: 14px;
          background: var(--brand);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(35, 56, 79, 0.16);
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }

        .button:hover,
        button:hover {
          transform: translateY(-1px);
          background: var(--brand-deep);
          color: #fff;
        }

        .button.secondary {
          background: #fff;
          color: var(--ink);
          border: 1px solid var(--line);
          box-shadow: none;
        }

        .button.secondary:hover {
          background: var(--surface-soft);
          color: var(--ink);
        }

        .button.whatsapp {
          background: var(--success);
        }

        .button.whatsapp:hover {
          background: #245640;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 32px;
          padding: 0 10px;
          border-radius: 999px;
          background: var(--brand-soft);
          color: var(--brand);
          font-size: 0.88rem;
          white-space: nowrap;
        }

        .status-badge.success {
          background: var(--success-soft);
          color: var(--success);
        }

        .status-badge.warning {
          background: var(--warning-soft);
          color: var(--warning);
        }

        .status-badge.danger {
          background: var(--danger-soft);
          color: var(--danger);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          text-align: right;
          padding: 15px 12px;
          border-bottom: 1px solid rgba(221, 214, 203, 0.85);
          vertical-align: top;
          font-size: 0.95rem;
        }

        th {
          color: var(--ink-faint);
          font-weight: 600;
          font-size: 0.86rem;
        }

        tbody tr:hover {
          background: rgba(255, 255, 255, 0.38);
        }

        .amount-strong {
          font-weight: 700;
          color: var(--brand-deep);
        }

        .inline-code {
          direction: ltr;
          display: inline-block;
          background: var(--surface-soft);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 8px 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.9rem;
          word-break: break-all;
        }

        .empty-state {
          padding: 24px;
          border-radius: 18px;
          background: var(--surface-soft);
          border: 1px dashed var(--line-strong);
          color: var(--ink-soft);
          line-height: 1.8;
          text-align: center;
        }

        .note,
        .success-box,
        .warning-box,
        .error-box {
          padding: 14px 16px;
          border-radius: 16px;
          line-height: 1.7;
          font-size: 0.94rem;
          margin-top: 14px;
        }

        .note {
          background: var(--surface-soft);
          border: 1px solid var(--line);
          color: var(--ink-soft);
        }

        .success-box {
          background: var(--success-soft);
          border: 1px solid rgba(45, 106, 79, 0.16);
          color: var(--success);
        }

        .warning-box {
          background: var(--warning-soft);
          border: 1px solid rgba(154, 106, 46, 0.16);
          color: var(--warning);
        }

        .error-box {
          background: var(--danger-soft);
          border: 1px solid rgba(143, 61, 61, 0.16);
          color: var(--danger);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .summary-card {
          padding: 18px;
          border-radius: 18px;
          background: var(--surface-soft);
          border: 1px solid var(--line);
        }

        .summary-card strong {
          display: block;
          margin-bottom: 6px;
          color: var(--ink-faint);
          font-size: 0.86rem;
          font-weight: 600;
        }

        .summary-card span {
          display: block;
          color: var(--ink);
          font-size: 1.08rem;
          line-height: 1.5;
        }

        .timeline {
          display: grid;
          gap: 10px;
        }

        .timeline-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 16px;
          background: var(--surface-soft);
          border: 1px solid var(--line);
        }

        .timeline-item strong {
          color: var(--ink-faint);
          font-size: 0.88rem;
        }

        .disclosure {
          margin-top: 16px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: var(--surface-soft);
          overflow: hidden;
        }

        .disclosure summary {
          list-style: none;
          cursor: pointer;
          padding: 16px 18px;
          font-weight: 600;
          color: var(--ink);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .disclosure summary::-webkit-details-marker {
          display: none;
        }

        .disclosure summary::before {
          content: "▾";
          color: var(--ink-faint);
          transition: transform 180ms ease;
        }

        .disclosure[open] summary::before {
          transform: rotate(180deg);
        }

        .disclosure-content {
          padding: 0 18px 18px;
          display: grid;
          gap: 14px;
        }

        .technical-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .technical-item {
          padding: 14px 15px;
          border-radius: 14px;
          background: #fff;
          border: 1px solid var(--line);
        }

        .technical-item strong {
          display: block;
          margin-bottom: 6px;
          color: var(--ink-faint);
          font-size: 0.84rem;
        }

        .copy-toast-anchor {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .copy-toast {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 165px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(22, 35, 49, 0.95);
          color: #fff;
          font-size: 0.9rem;
          opacity: 0;
          transform: translateY(-4px);
          pointer-events: none;
          transition: opacity 180ms ease, transform 180ms ease;
          white-space: nowrap;
          z-index: 10;
          box-shadow: 0 12px 26px rgba(17, 27, 38, 0.2);
        }

        .copy-toast.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .pagination {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 20px;
        }

        .pagination a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid var(--line);
        }

        .status-page {
          max-width: 760px;
        }

        @media (max-width: 1200px) {
          .metric-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .split-grid {
            grid-template-columns: 1fr;
          }

          .hero {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 960px) {
          .layout,
          .form-grid.two-columns,
          .summary-grid,
          .technical-grid {
            grid-template-columns: 1fr;
          }

          .metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sidebar {
            position: static;
            min-height: auto;
          }

          .sidebar,
          main {
            padding: 20px;
          }
        }

        @media (max-width: 640px) {
          main {
            padding: 16px;
          }

          .metric-grid {
            grid-template-columns: 1fr;
          }

          .hero,
          .card {
            padding: 20px;
          }

          .page-title {
            font-size: 1.7rem;
          }

          th,
          td {
            padding: 12px 8px;
          }
        }
      </style>
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <div class="brand">
            <small>נמרודי ושות׳ — רואי חשבון</small>
            <h1>מערכת תשלומים</h1>
            <p>ניהול בקשות תשלום, מעקב אחר סטטוסים ושליחת קישור ללקוח בצורה מסודרת ונעימה.</p>
          </div>
          <nav>
            ${navItems
              .map(
                (item) => `
                  <a href="${item.href}" class="${input.activePath === item.key ? "active" : ""}">
                    ${item.label}
                  </a>
                `
              )
              .join("")}
          </nav>
          <div class="sidebar-footnote">
            ממשק ניהול שקט, מדויק וברור לעבודה שוטפת מול לקוחות, תשלומים ומסמכים.
          </div>
        </aside>
        <main>
          <div class="topbar">
            <div>
              ${
                input.pageTitle
                  ? `<div class="page-kicker">${escapeHtml(input.pageTitle)}</div>`
                  : ""
              }
              <h2 class="page-title">${escapeHtml(input.title)}</h2>
            </div>
            <div class="topbar-actions">
              ${
                input.appConfig.appEnv !== "production"
                  ? `<span class="meta-chip">סביבה: ${escapeHtml(getEnvironmentLabel(input.appConfig.appEnv))}</span>`
                  : ""
              }
              <span class="meta-chip">מצב תשלום: ${escapeHtml(getGrowModeLabel(input.appConfig))}</span>
              <form method="post" action="/logout">
                <button type="submit" class="button secondary">התנתקות</button>
              </form>
            </div>
          </div>
          ${renderContextRow(input.appConfig)}
          ${input.content}
        </main>
      </div>
      <script>
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

          if (feedback.dataset.timeoutId) {
            window.clearTimeout(Number(feedback.dataset.timeoutId));
          }

          const showToast = (message) => {
            feedback.textContent = message;
            feedback.classList.add("is-visible");
            const timeoutId = window.setTimeout(() => {
              feedback.classList.remove("is-visible");
            }, 2000);
            feedback.dataset.timeoutId = String(timeoutId);
          };

          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(text);
              showToast("הקישור הועתק");
            } else {
              showToast("העתקה אוטומטית לא נתמכת בדפדפן זה");
            }
          } catch {
            showToast("לא ניתן היה להעתיק את הקישור");
          }
        });

        document.addEventListener("submit", async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLFormElement)) return;

          if (
            !target.hasAttribute("data-mock-webhook-form") &&
            !target.hasAttribute("data-mock-invoice-form")
          ) {
            return;
          }

          event.preventDefault();

          try {
            let query;

            if (target.hasAttribute("data-mock-webhook-form")) {
              const formData = new FormData(target);
              const payload = Object.fromEntries(formData.entries());
              payload.amount_agorot = Number(payload.amount_agorot);
              payload.occurred_at = new Date().toISOString();

              const response = await fetch("/api/mock-grow/webhook", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload)
              });
              const data = await response.json();

              query = new URLSearchParams({
                simulator_outcome: String(data.outcome || "failed"),
                simulator_message: String(
                  data.message || "פעולת ההדגמה הסתיימה."
                )
              });
            } else {
              const endpoint = target.getAttribute("data-endpoint");
              if (!endpoint) {
                throw new Error("חסר יעד ליצירת מסמך.");
              }

              const response = await fetch(endpoint, {
                method: "POST"
              });
              const data = await response.json();

              query = new URLSearchParams({
                invoice_outcome: String(data.outcome || "failed"),
                invoice_message: String(
                  data.message || "פעולת יצירת המסמך הסתיימה."
                )
              });
            }

            const redirectBase =
              target.getAttribute("data-redirect") || window.location.pathname;

            window.location.href = redirectBase + "?" + query.toString();
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : target.hasAttribute("data-mock-webhook-form")
                  ? "לא ניתן היה להשלים את פעולת ההדגמה."
                  : "לא ניתן היה ליצור מסמך.";
            const redirectBase =
              target.getAttribute("data-redirect") || window.location.pathname;
            const query = new URLSearchParams({
              [target.hasAttribute("data-mock-webhook-form")
                ? "simulator_outcome"
                : "invoice_outcome"]: "failed",
              [target.hasAttribute("data-mock-webhook-form")
                ? "simulator_message"
                : "invoice_message"]: message
            });
            window.location.href = redirectBase + "?" + query.toString();
          }
        });
      </script>
    </body>
  </html>`;
}

function renderContextRow(appConfig: AppConfig) {
  const items: string[] = [];

  if (appConfig.growMode === "mock") {
    items.push("סביבת הדגמה פעילה");
  }

  if (appConfig.invoiceMode === "mock") {
    items.push("מסמכי דמו זמינים לצפייה");
  }

  if (appConfig.enableDevTools) {
    items.push("כלי הדגמה זמינים במסכים הרלוונטיים");
  }

  if (items.length === 0) {
    return "";
  }

  return `
    <div class="context-row">
      ${items.map((item) => `<span class="meta-chip">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function getStatusBadgeClass(status: Payment["status"]) {
  if (status === "paid") {
    return "status-badge success";
  }

  if (status === "failed" || status === "cancelled" || status === "expired") {
    return "status-badge danger";
  }

  return "status-badge warning";
}

function renderPaymentRows(items: PaymentListItemView[]) {
  if (items.length === 0) {
    return `
      <tr>
        <td colspan="8">
          <div class="empty-state">עדיין לא נוצרו בקשות תשלום. אפשר להתחיל ביצירת בקשה חדשה ללקוח.</div>
        </td>
      </tr>
    `;
  }

  return items
    .map(
      ({ payment, invoice }) => `
        <tr>
          <td>${formatDateTime(payment.createdAt)}</td>
          <td>
            <strong>${escapeHtml(payment.customerName)}</strong><br />
            <span style="color: var(--ink-faint);">${escapeHtml(payment.description)}</span>
          </td>
          <td>${escapeHtml(payment.customerPhone ?? "—")}<br /><span style="color: var(--ink-faint);">${escapeHtml(payment.customerEmail ?? "—")}</span></td>
          <td class="amount-strong">${formatAmountAgorot(payment.amountAgorot)}</td>
          <td><span class="${getStatusBadgeClass(payment.status)}">${getPaymentStatusLabel(payment.status)}</span></td>
          <td>${
            invoice?.invoiceUrl
              ? `<a href="${escapeHtml(invoice.invoiceUrl)}" target="_blank" rel="noreferrer">קבלה נוצרה</a>`
              : payment.invoiceId
                ? "קבלה נוצרה — בפרטים"
                : "טרם נוצרה"
          }</td>
          <td>${
            payment.paymentUrl
              ? `<a href="${escapeHtml(payment.paymentUrl)}" target="_blank" rel="noreferrer">פתיחת קישור</a>`
              : "—"
          }</td>
          <td><a href="/admin/payments/${payment.id}">לצפייה</a></td>
        </tr>
      `
    )
    .join("");
}

function renderEmptyBreakdown() {
  return `
    <div class="empty-state">
      לאחר יצירת עסקאות יופיע כאן פירוט לפי סטטוסים.
    </div>
  `;
}

function renderBreakdown(metrics: DashboardMetrics) {
  const maxCount = Math.max(
    1,
    ...metrics.statusBreakdown.map((item) => item.count)
  );
  const visibleItems = metrics.statusBreakdown.filter((item) => item.count > 0);

  if (visibleItems.length === 0) {
    return renderEmptyBreakdown();
  }

  return `
    <div class="breakdown-list">
      ${visibleItems
        .map(
          (item) => `
            <div class="breakdown-item">
              <div class="breakdown-head">
                <strong>${item.label}</strong>
                <span>${item.count}</span>
              </div>
              <div class="breakdown-bar">
                <span style="width: ${(item.count / maxCount) * 100}%"></span>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTimeline(payment: Payment) {
  const items = [
    ["נוצרה", payment.createdAt],
    ["עודכנה", payment.updatedAt],
    ["שולמה", payment.paidAt],
    ["בוטלה", payment.cancelledAt],
    ["נכשלה", payment.failedAt]
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  if (items.length === 0) {
    return `<div class="empty-state">עדיין אין תאריכים מהותיים להצגה.</div>`;
  }

  return `
    <div class="timeline">
      ${items
        .map(
          ([label, value]) => `
            <div class="timeline-item">
              <strong>${label}</strong>
              <span>${formatDateTime(value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderWebhookRecords(webhooks: PaymentWebhookRecord[]) {
  if (webhooks.length === 0) {
    return `
      <div class="empty-state">
        עדיין לא נשמרו אירועי וובהוק לעסקה זו.
      </div>
    `;
  }

  return `
    <div class="card-stack" style="gap: 12px;">
      ${webhooks
        .map(
          (webhook) => `
            <div class="technical-item">
              <div class="button-row" style="margin: 0 0 10px;">
                <span class="status-badge">${escapeHtml(getWebhookEventLabel(webhook.eventType))}</span>
                <span class="${
                  webhook.processingStatus === "processed"
                    ? "status-badge success"
                    : webhook.processingStatus === "failed"
                      ? "status-badge danger"
                      : "status-badge"
                }">${escapeHtml(
                  getWebhookProcessingStatusLabel(webhook.processingStatus)
                )}</span>
              </div>
              <div class="technical-grid">
                <div class="technical-item">
                  <strong>התקבל בתאריך</strong>
                  ${formatDateTime(webhook.receivedAt)}
                </div>
                <div class="technical-item">
                  <strong>עודכן בתאריך</strong>
                  ${formatDateTime(webhook.processedAt)}
                </div>
                <div class="technical-item">
                  <strong>מזהה אירוע אצל הספק</strong>
                  ${escapeHtml(webhook.providerEventId ?? "—")}
                </div>
                <div class="technical-item">
                  <strong>מזהה עסקה אצל הספק</strong>
                  ${escapeHtml(webhook.providerTransactionId ?? "—")}
                </div>
              </div>
              ${
                webhook.processingError
                  ? `<div class="error-box">${escapeHtml(webhook.processingError)}</div>`
                  : ""
              }
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSimulatorForms(payment: Payment, redirectPath: string) {
  if (isFinalPaymentStatus(payment.status)) {
    return `
      <div class="note">
        העסקה כבר הסתיימה. אפשר עדיין להפעיל אירוע דמו חוזר לצורך בדיקת התנהגות בטוחה.
      </div>
      ${renderSimulatorButtons(payment, redirectPath)}
    `;
  }

  return renderSimulatorButtons(payment, redirectPath);
}

function renderSimulatorButtons(payment: Payment, redirectPath: string) {
  const statuses = [
    { eventType: "payment.paid", status: "paid", label: "סימון כשולם" },
    { eventType: "payment.failed", status: "failed", label: "סימון כנכשל" },
    {
      eventType: "payment.cancelled",
      status: "cancelled",
      label: "סימון כמבוטל"
    },
    {
      eventType: "payment.expired",
      status: "expired",
      label: "סימון כפג תוקף"
    }
  ] as const;

  return `
    <div class="button-row">
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
              <button type="submit" class="button secondary">${label}</button>
            </form>
          `
        )
        .join("")}
    </div>
  `;
}

function renderInvoiceSection(input: {
  payment: Payment;
  invoice: InvoiceRecord | null;
}) {
  if (!input.invoice) {
    return `
      <div class="summary-grid">
        <div class="summary-card">
          <strong>מצב מסמך</strong>
          <span>${
            input.payment.status === "paid"
              ? "המערכת תנסה להפיק מסמך לאחר אישור התשלום."
              : "המסמך יופיע לאחר אישור התשלום."
          }</span>
        </div>
        <div class="summary-card">
          <strong>קישור למסמך</strong>
          <span>עדיין לא זמין</span>
        </div>
        <div class="summary-card">
          <strong>הערה</strong>
          <span>במסך הדגמה זהו מסמך תצוגה בלבד.</span>
        </div>
      </div>
      ${
        input.payment.status === "paid"
          ? `
            <div class="button-row">
              <form method="post" data-mock-invoice-form data-endpoint="/api/payments/${escapeHtml(input.payment.id)}/invoice/mock" data-redirect="/admin/payments/${escapeHtml(input.payment.id)}">
                <button type="submit" class="button secondary">יצירת מסמך דמו</button>
              </form>
            </div>
          `
          : ""
      }
    `;
  }

  const canRetry =
    input.payment.status === "paid" &&
    (input.invoice.status === "failed" || input.invoice.status === "pending");

  return `
    <div class="summary-grid">
      <div class="summary-card">
        <strong>מצב מסמך</strong>
        <span>${getInvoiceDisplayState(input.invoice)}</span>
      </div>
      <div class="summary-card">
        <strong>מספר מסמך</strong>
        <span>${escapeHtml(input.invoice.invoiceNumber ?? "—")}</span>
      </div>
      <div class="summary-card">
        <strong>תיאור</strong>
        <span>מסמך דמו לצפייה ולהדגמה בלבד</span>
      </div>
    </div>
    ${
      input.invoice.invoiceUrl
        ? `
          <div class="button-row">
            <a class="button secondary" href="${escapeHtml(input.invoice.invoiceUrl)}" target="_blank" rel="noreferrer">פתיחת מסמך דמו</a>
          </div>
        `
        : ""
    }
    <div class="note">המסמך המוצג כאן מיועד להדגמה בלבד ואינו מסמך חשבונאי או משפטי.</div>
    ${
      canRetry
        ? `
          <div class="button-row">
            <form method="post" data-mock-invoice-form data-endpoint="/api/payments/${escapeHtml(input.payment.id)}/invoice/mock" data-redirect="/admin/payments/${escapeHtml(input.payment.id)}">
              <button type="submit" class="button secondary">ניסיון נוסף ליצירת מסמך</button>
            </form>
          </div>
        `
        : ""
    }
  `;
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
        :root {
          --bg: #f4f2ee;
          --surface: #fffdf8;
          --line: #ddd6cb;
          --ink: #162331;
          --ink-soft: #5b6876;
          --brand: #23384f;
          --danger: #8f3d3d;
          --shadow: 0 18px 40px rgba(17, 27, 38, 0.08);
          --font: "Noto Sans Hebrew", "Segoe UI", sans-serif;
        }

        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          font-family: var(--font);
          color: var(--ink);
          background:
            radial-gradient(circle at top right, rgba(35, 56, 79, 0.06), transparent 28%),
            linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
        }

        .card {
          width: min(460px, 100%);
          padding: 30px;
          border-radius: 26px;
          border: 1px solid var(--line);
          background: rgba(255, 253, 248, 0.96);
          box-shadow: var(--shadow);
        }

        .eyebrow {
          margin-bottom: 8px;
          color: var(--ink-soft);
          font-size: 0.9rem;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 2rem;
        }

        p {
          margin: 0;
          color: var(--ink-soft);
          line-height: 1.8;
        }

        label {
          display: grid;
          gap: 8px;
          margin-top: 22px;
          color: var(--ink-soft);
        }

        input {
          width: 100%;
          box-sizing: border-box;
          padding: 13px 14px;
          border-radius: 14px;
          border: 1px solid var(--line);
          font: inherit;
        }

        button {
          margin-top: 18px;
          width: 100%;
          min-height: 48px;
          border: 0;
          border-radius: 14px;
          background: var(--brand);
          color: #fff;
          cursor: pointer;
          font: inherit;
        }

        .error,
        .note {
          margin-top: 16px;
          padding: 13px 14px;
          border-radius: 14px;
          line-height: 1.7;
        }

        .error {
          background: #f6e5e5;
          color: var(--danger);
        }

        .note {
          background: #eef2f6;
          color: var(--brand);
        }
      </style>
    </head>
    <body>
      <section class="card">
        <div class="eyebrow">נמרודי ושות׳ — רואי חשבון</div>
        <h1>כניסה למערכת</h1>
        <p>אזור זה מיועד לשימוש ניהולי בלבד לצורך יצירת בקשות תשלום, מעקב אחר עסקאות וצפייה במסמכים.</p>
        ${input.errorMessage ? `<div class="error">${escapeHtml(input.errorMessage)}</div>` : ""}
        ${
          input.appConfig.appEnv !== "production"
            ? `<div class="note">המערכת זמינה כעת בסביבת ${escapeHtml(getEnvironmentLabel(input.appConfig.appEnv))}.</div>`
            : ""
        }
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
    title: "לוח בקרה",
    activePath: "dashboard",
    pageTitle: "סקירה כללית",
    content: `
      <section class="hero">
        <div>
          <h2>תמונת מצב שוטפת של בקשות התשלום</h2>
          <p>מבט מרוכז על הפעילות האחרונה: כמה בקשות נשלחו, כמה כבר שולמו, ומה עדיין דורש טיפול או מעקב.</p>
        </div>
        <div class="hero-panel">
          <strong>מה אפשר לעשות מכאן</strong>
          <span>ליצור בקשת תשלום חדשה, לעקוב אחר עסקאות פתוחות, ולהמשיך ישירות לפרטי כל עסקה.</span>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>מדדים מרכזיים</h3>
            <p>תצוגה מרוכזת של תמונת הפעילות במערכת.</p>
          </div>
        </div>
        <div class="metric-grid">
          <div class="metric-card">
            <span>סך בקשות תשלום</span>
            <strong>${input.metrics.totalRequests}</strong>
            <small>כלל העסקאות שנוצרו</small>
          </div>
          <div class="metric-card">
            <span>תשלומים ששולמו</span>
            <strong>${input.metrics.paidCount}</strong>
            <small>עסקאות שסומנו כשולמו</small>
          </div>
          <div class="metric-card">
            <span>תשלומים ממתינים</span>
            <strong>${input.metrics.pendingCount}</strong>
            <small>טיוטות, קישורים פתוחים ותשלומים ממתינים</small>
          </div>
          <div class="metric-card">
            <span>סכום ששולם</span>
            <strong>${formatAmountAgorot(input.metrics.paidAmountAgorot)}</strong>
            <small>סך הסכום שאושר</small>
          </div>
          <div class="metric-card">
            <span>סכום ממתין</span>
            <strong>${formatAmountAgorot(input.metrics.pendingAmountAgorot)}</strong>
            <small>סכום שעדיין ממתין לתשלום</small>
          </div>
        </div>
      </section>

      <section class="split-grid">
        <section class="card">
          <div class="section-head">
            <div>
              <h3>עסקאות אחרונות</h3>
              <p>העסקאות האחרונות שנוצרו במערכת, עם גישה מהירה לפרטים ולמסמכים.</p>
            </div>
            <a class="button secondary" href="/admin/payments">לכל העסקאות</a>
          </div>
          <table>
            <thead>
              <tr>
                <th>נוצרה</th>
                <th>לקוח</th>
                <th>פרטי קשר</th>
                <th>סכום</th>
                <th>סטטוס</th>
                <th>מסמך</th>
                <th>קישור</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderPaymentRows(input.payments)}</tbody>
          </table>
        </section>

        <div class="card-stack">
          <section class="card">
            <div class="section-head">
              <div>
                <h3>התפלגות סטטוסים</h3>
                <p>חלוקה מהירה של הבקשות לפי מצב התשלום.</p>
              </div>
            </div>
            ${renderBreakdown(input.metrics)}
          </section>

          <section class="card">
            <div class="section-head">
              <div>
                <h3>פעולות מהירות</h3>
                <p>קישורים קצרים למשימות המרכזיות במערכת.</p>
              </div>
            </div>
            <div class="quick-actions">
              <a class="quick-action" href="/admin/payments/new">
                <strong>יצירת בקשת תשלום</strong>
                <span>פתיחת בקשה חדשה עם קישור תשלום מוכן לשליחה.</span>
              </a>
              <a class="quick-action" href="/admin/payments">
                <strong>רשימת עסקאות</strong>
                <span>מעקב אחר סטטוסים, מסמכים וקישורי תשלום.</span>
              </a>
              <a class="quick-action" href="/admin/settings/client-requirements">
                <strong>סטטוס מערכת</strong>
                <span>סיכום סביבת העבודה ופעולות ניהול זמינות.</span>
              </a>
            </div>
          </section>
        </div>
      </section>
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
    title: "יצירת בקשת תשלום",
    activePath: "new-payment",
    pageTitle: "בקשה חדשה",
    content: `
      <section class="hero">
        <div>
          <h2>יצירת בקשת תשלום חדשה</h2>
          <p>ממלאים את פרטי הלקוח, הסכום ותיאור הבקשה. לאחר השמירה יוצג קישור תשלום מוכן להעתקה ולשליחה.</p>
        </div>
        <div class="hero-panel">
          <strong>טיפ קצר</strong>
          <span>הסכום מוזן בשקלים מטעמי נוחות, והמערכת ממירה אותו לאגורות ברקע.</span>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>פרטי הבקשה</h3>
            <p>המידע כאן משמש ליצירת הקישור ולתצוגה ברשימת העסקאות.</p>
          </div>
        </div>
        ${
          input.errorMessage
            ? `<div class="error-box">${escapeHtml(input.errorMessage)}</div>`
            : ""
        }
        <form id="payment-form" class="form-grid" method="post" action="/api/payments">
          <div class="form-grid two-columns">
            <label>
              שם הלקוח
              <input name="customer_name" required value="${escapeHtml(values.customer_name ?? "")}" />
            </label>
            <label>
              טלפון
              <input name="customer_phone" value="${escapeHtml(values.customer_phone ?? "")}" placeholder="0501234567" />
            </label>
          </div>
          <div class="form-grid two-columns">
            <label>
              אימייל
              <input name="customer_email" type="email" value="${escapeHtml(values.customer_email ?? "")}" placeholder="client@example.com" />
            </label>
            <label>
              סכום בשקלים
              <input name="amount_shekel" type="number" step="0.01" min="0.01" required value="${escapeHtml(values.amount_shekel ?? "")}" placeholder="1250.00" />
            </label>
          </div>
          <label>
            תיאור הבקשה
            <textarea name="description" required placeholder="שכר טרחה עבור דוח שנתי">${escapeHtml(values.description ?? "")}</textarea>
          </label>
          <div class="button-row">
            <button type="submit">יצירת בקשה</button>
            <a class="button secondary" href="/admin/payments">חזרה לרשימת העסקאות</a>
          </div>
        </form>
      </section>
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
              if (!response.ok) {
                throw new Error(data.error || "לא ניתן היה ליצור בקשת תשלום.");
              }

              window.location.href = "/admin/payments/" + data.payment.id;
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "לא ניתן היה ליצור בקשת תשלום.";
              window.location.href =
                "/admin/payments/new?error=" +
                encodeURIComponent(message) +
                "&customer_name=" +
                encodeURIComponent(String(payload.customer_name || "")) +
                "&customer_phone=" +
                encodeURIComponent(String(payload.customer_phone || "")) +
                "&customer_email=" +
                encodeURIComponent(String(payload.customer_email || "")) +
                "&amount_shekel=" +
                encodeURIComponent(String(payload.amount_shekel || "")) +
                "&description=" +
                encodeURIComponent(String(payload.description || ""));
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
}) {
  const previousOffset = Math.max(
    0,
    input.payments.offset - input.payments.limit
  );
  const nextOffset = input.payments.offset + input.payments.limit;

  return renderLayout({
    appConfig: input.appConfig,
    title: "עסקאות",
    activePath: "payments",
    pageTitle: "רשימת עסקאות",
    content: `
      <section class="hero">
        <div>
          <h2>רשימת עסקאות</h2>
          <p>תצוגה מסודרת של כל בקשות התשלום, סטטוס התשלום, קישור התשלום והמסמך הנלווה כאשר הוא זמין.</p>
        </div>
        <div class="hero-panel">
          <strong>פעולות זמינות</strong>
          <span>אפשר לייצא נתונים, לפתוח עסקה קיימת או ליצור בקשה חדשה.</span>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>כל הבקשות</h3>
            <p>רשימה נקייה ופשוטה לצפייה ולעבודה שוטפת.</p>
          </div>
          <div class="button-row" style="margin-top: 0;">
            <a class="button secondary" href="/admin/payments/export.csv">ייצוא CSV</a>
            <a class="button" href="/admin/payments/new">יצירת בקשה חדשה</a>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>נוצרה</th>
              <th>לקוח</th>
              <th>פרטי קשר</th>
              <th>סכום</th>
              <th>סטטוס</th>
              <th>מסמך</th>
              <th>קישור</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${renderPaymentRows(
            input.payments.items.map((payment) => ({
              payment,
              invoice: input.invoiceByPaymentId[payment.id] ?? null
            }))
          )}</tbody>
        </table>
        <div class="pagination">
          ${
            input.payments.offset > 0
              ? `<a href="/admin/payments?limit=${input.payments.limit}&offset=${previousOffset}">עמוד קודם</a>`
              : ""
          }
          ${
            input.payments.hasMore
              ? `<a href="/admin/payments?limit=${input.payments.limit}&offset=${nextOffset}">עמוד הבא</a>`
              : ""
          }
        </div>
      </section>
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

  return renderLayout({
    appConfig: input.appConfig,
    title: "פרטי עסקה",
    activePath: "payments",
    pageTitle: "עסקה",
    content: `
      <section class="hero">
        <div>
          <h2>${escapeHtml(input.payment.customerName)}</h2>
          <p>פרטי הלקוח, מצב התשלום, הקישור שנשלח והמסמך הנלווה מרוכזים כאן לצפייה ולעבודה שוטפת.</p>
        </div>
        <div class="hero-panel">
          <strong>סטטוס נוכחי</strong>
          <span class="${getStatusBadgeClass(input.payment.status)}">${getPaymentStatusLabel(input.payment.status)}</span>
        </div>
      </section>

      <div class="card-stack">
        <section class="card">
          ${
            input.simulatorMessage
              ? input.simulatorOutcome === "failed"
                ? `<div class="error-box">${escapeHtml(input.simulatorMessage)}</div>`
                : input.simulatorOutcome === "duplicate"
                  ? `<div class="warning-box">${escapeHtml(input.simulatorMessage)}</div>`
                  : `<div class="success-box">${escapeHtml(input.simulatorMessage)}</div>`
              : ""
          }
          ${
            input.invoiceMessage
              ? input.invoiceOutcome === "failed"
                ? `<div class="error-box">${escapeHtml(input.invoiceMessage)}</div>`
                : input.invoiceOutcome === "existing"
                  ? `<div class="warning-box">${escapeHtml(input.invoiceMessage)}</div>`
                  : `<div class="success-box">${escapeHtml(input.invoiceMessage)}</div>`
              : ""
          }
          <div class="section-head">
            <div>
              <h3>פרטי העסקה</h3>
              <p>המידע המרכזי הנדרש לצפייה, שיתוף ומעקב.</p>
            </div>
          </div>
          <div class="summary-grid">
            <div class="summary-card">
              <strong>לקוח</strong>
              <span>${escapeHtml(input.payment.customerName)}</span>
            </div>
            <div class="summary-card">
              <strong>טלפון</strong>
              <span>${escapeHtml(input.payment.customerPhone ?? "—")}</span>
            </div>
            <div class="summary-card">
              <strong>אימייל</strong>
              <span>${escapeHtml(input.payment.customerEmail ?? "—")}</span>
            </div>
            <div class="summary-card">
              <strong>סכום</strong>
              <span>${formatAmountAgorot(input.payment.amountAgorot)}</span>
            </div>
            <div class="summary-card">
              <strong>סטטוס תשלום</strong>
              <span>${getPaymentStatusLabel(input.payment.status)}</span>
            </div>
            <div class="summary-card">
              <strong>תיאור</strong>
              <span>${escapeHtml(input.payment.description)}</span>
            </div>
          </div>

          <div class="section-head" style="margin-top: 24px;">
            <div>
              <h3>קישור תשלום</h3>
              <p>אפשר להעתיק את הקישור או לפתוח הודעה מוכנה לשליחה ב-WhatsApp.</p>
            </div>
          </div>
          <div class="inline-code">${escapeHtml(input.payment.paymentUrl ?? "קישור התשלום עדיין לא זמין")}</div>
          <div class="button-row">
            ${
              input.payment.paymentUrl
                ? `
                  <span class="copy-toast-anchor">
                    <button
                      type="button"
                      data-copy-text="${escapeHtml(input.payment.paymentUrl)}"
                      data-copy-feedback="copy-feedback"
                    >
                      העתקת קישור
                    </button>
                    <span id="copy-feedback" class="copy-toast" aria-live="polite"></span>
                  </span>
                  <a class="button secondary" href="${escapeHtml(input.payment.paymentUrl)}" target="_blank" rel="noreferrer">פתיחת קישור תשלום</a>
                `
                : ""
            }
            ${
              whatsappLink
                ? `<a class="button whatsapp" href="${escapeHtml(whatsappLink)}" target="_blank" rel="noreferrer">פתיחת WhatsApp</a>`
                : ""
            }
            <a class="button secondary" href="/admin/payments">חזרה לרשימה</a>
          </div>
        </section>

        <section class="split-grid">
          <section class="card">
            <div class="section-head">
              <div>
                <h3>מסמך</h3>
                <p>המסמך הנלווה לעסקה יוצג כאן כאשר הוא זמין.</p>
              </div>
            </div>
            ${renderInvoiceSection({
              payment: input.payment,
              invoice: input.invoice
            })}
          </section>

          <section class="card">
            <div class="section-head">
              <div>
                <h3>תאריכים חשובים</h3>
                <p>סקירה מהירה של אבני הדרך העיקריות בעסקה.</p>
              </div>
            </div>
            ${renderTimeline(input.payment)}
          </section>
        </section>

        <section class="card">
          <details class="disclosure">
            <summary>פרטים טכניים</summary>
            <div class="disclosure-content">
              <div class="technical-grid">
                <div class="technical-item">
                  <strong>מזהה תשלום</strong>
                  ${escapeHtml(input.payment.id)}
                </div>
                <div class="technical-item">
                  <strong>סטטוס פנימי</strong>
                  ${escapeHtml(input.payment.status)}
                </div>
                <div class="technical-item">
                  <strong>ספק</strong>
                  ${escapeHtml(getProviderLabel(input.payment.provider))}
                </div>
                <div class="technical-item">
                  <strong>מזהה תשלום אצל הספק</strong>
                  ${escapeHtml(input.payment.providerPaymentId ?? "—")}
                </div>
                <div class="technical-item">
                  <strong>מזהה עסקה אצל הספק</strong>
                  ${escapeHtml(input.payment.providerTransactionId ?? "—")}
                </div>
                <div class="technical-item">
                  <strong>מזהה מסמך במערכת</strong>
                  ${escapeHtml(input.payment.invoiceId ?? "—")}
                </div>
              </div>
              <details class="disclosure">
                <summary>אירועי וובהוק</summary>
                <div class="disclosure-content">
                  ${renderWebhookRecords(input.webhooks)}
                </div>
              </details>
            </div>
          </details>

          ${
            input.appConfig.enableDevTools
              ? `
                <details class="disclosure">
                  <summary>כלי הדגמה</summary>
                  <div class="disclosure-content">
                    <p style="margin: 0; color: var(--ink-soft); line-height: 1.8;">
                      פעולות אלו נועדו להדגמה מבוקרת של מעבר בין מצבי תשלום ויצירת מסמך דמו.
                    </p>
                    ${renderSimulatorForms(input.payment, `/admin/payments/${input.payment.id}`)}
                    <div class="note">פעולות ההדגמה אינן משנות את מבנה המערכת וניתן להשתמש בהן רק לצורך הצגה ובדיקה.</div>
                  </div>
                </details>
              `
              : ""
          }
        </section>
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
    pageTitle: "הדגמת תשלום",
    content: `
      <section class="hero">
        <div>
          <h2>עמוד תשלום דמו</h2>
          <p>עמוד זה מיועד להדגמה בלבד ומשמש להצגת תהליך התשלום והעדכון במערכת.</p>
        </div>
        <div class="hero-panel">
          <strong>לקוח</strong>
          <span>${escapeHtml(input.payment.customerName)}</span>
        </div>
      </section>
      <div class="card-stack">
        <section class="card">
          <div class="summary-grid">
            <div class="summary-card">
              <strong>סכום</strong>
              <span>${formatAmountAgorot(input.payment.amountAgorot)}</span>
            </div>
            <div class="summary-card">
              <strong>תיאור</strong>
              <span>${escapeHtml(input.payment.description)}</span>
            </div>
            <div class="summary-card">
              <strong>סטטוס</strong>
              <span>${getPaymentStatusLabel(input.payment.status)}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>פעולות הדגמה</h3>
              <p>בחירת תוצאה מדגימה את עדכון הסטטוס במסך העסקה.</p>
            </div>
          </div>
          ${renderSimulatorForms(
            input.payment,
            `/dev/mock-grow/pay/${input.payment.providerPaymentId ?? ""}`
          )}
        </section>

        <section class="card">
          <details class="disclosure">
            <summary>אירועי וובהוק שנשמרו</summary>
            <div class="disclosure-content">
              ${renderWebhookRecords(input.webhooks)}
            </div>
          </details>
          <div class="button-row">
            <a class="button secondary" href="/admin/payments/${input.payment.id}">חזרה לפרטי העסקה</a>
          </div>
        </section>
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
    pageTitle: "מסמך לצפייה",
    content: `
      <section class="hero">
        <div>
          <h2>מסמך דמו לצפייה</h2>
          <p>זהו מסמך תצוגה בלבד המשמש להדגמת הזרימה לאחר אישור תשלום.</p>
        </div>
        <div class="hero-panel">
          <strong>מספר מסמך</strong>
          <span>${escapeHtml(input.invoice.invoiceNumber ?? input.invoice.id)}</span>
        </div>
      </section>
      <section class="card">
        <div class="summary-grid">
          <div class="summary-card">
            <strong>לקוח</strong>
            <span>${escapeHtml(input.payment.customerName)}</span>
          </div>
          <div class="summary-card">
            <strong>סכום</strong>
            <span>${formatAmountAgorot(input.payment.amountAgorot)}</span>
          </div>
          <div class="summary-card">
            <strong>סטטוס</strong>
            <span>${getInvoiceStatusLabel(input.invoice.status)}</span>
          </div>
          <div class="summary-card">
            <strong>תיאור</strong>
            <span>${escapeHtml(input.payment.description)}</span>
          </div>
          <div class="summary-card">
            <strong>נוצר בתאריך</strong>
            <span>${formatDateTime(input.invoice.createdAt)}</span>
          </div>
          <div class="summary-card">
            <strong>עודכן בתאריך</strong>
            <span>${formatDateTime(input.invoice.updatedAt)}</span>
          </div>
        </div>
        <div class="note">המסמך המוצג כאן מיועד להדגמה בלבד ואינו מהווה מסמך חשבונאי או משפטי.</div>
        <details class="disclosure">
          <summary>פרטים טכניים</summary>
          <div class="disclosure-content">
            <div class="technical-grid">
              <div class="technical-item">
                <strong>מזהה תשלום</strong>
                ${escapeHtml(input.payment.id)}
              </div>
              <div class="technical-item">
                <strong>מזהה מסמך אצל הספק</strong>
                ${escapeHtml(input.invoice.providerInvoiceId ?? "—")}
              </div>
            </div>
          </div>
        </details>
        <div class="button-row">
          <a class="button secondary" href="/admin/payments/${escapeHtml(input.payment.id)}">חזרה לפרטי העסקה</a>
        </div>
      </section>
    `
  });
}

export function renderClientRequirementsPage(input: { appConfig: AppConfig }) {
  return renderLayout({
    appConfig: input.appConfig,
    title: "סטטוס מערכת",
    activePath: "dashboard",
    pageTitle: "מידע ניהולי",
    content: `
      <section class="hero">
        <div>
          <h2>סטטוס מערכת</h2>
          <p>תצוגה מרוכזת של סביבת העבודה הנוכחית, אפשרויות הניהול הזמינות והקישורים התפעוליים במערכת.</p>
        </div>
        <div class="hero-panel">
          <strong>סביבה פעילה</strong>
          <span>${escapeHtml(getEnvironmentLabel(input.appConfig.appEnv))}</span>
        </div>
      </section>
      <section class="split-grid">
        <section class="card">
          <div class="section-head">
            <div>
              <h3>תצורת הדגמה</h3>
              <p>פרטי הסביבה הרלוונטיים לשימוש השוטף במסך ההדגמה.</p>
            </div>
          </div>
          <div class="summary-grid">
            <div class="summary-card">
              <strong>מצב תשלום</strong>
              <span>${escapeHtml(getGrowModeLabel(input.appConfig))}</span>
            </div>
            <div class="summary-card">
              <strong>מצב מסמכים</strong>
              <span>${input.appConfig.invoiceMode === "mock" ? "דמו" : escapeHtml(input.appConfig.invoiceMode)}</span>
            </div>
            <div class="summary-card">
              <strong>כלי הדגמה</strong>
              <span>${input.appConfig.enableDevTools ? "זמינים" : "כבויים"}</span>
            </div>
          </div>
          <div class="note">לצורך הדגמה הלקוח רואה סביבת עבודה מלאה, אך ללא חיבור חי לשירותי תשלום או מסמכים חיצוניים.</div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>פעולות ניהול</h3>
              <p>קישורים מהירים לפעולות שימושיות בזמן הדגמה או עבודה שוטפת.</p>
            </div>
          </div>
          <div class="quick-actions">
            <a class="quick-action" href="/admin/payments/export.csv">
              <strong>ייצוא נתונים</strong>
              <span>הורדת קובץ CSV מרשימת העסקאות לצורכי בקרה ושיתוף.</span>
            </a>
            <a class="quick-action" href="/admin/payments/new">
              <strong>בקשה חדשה</strong>
              <span>פתיחת בקשת תשלום חדשה מתוך מסך מרוכז ונקי.</span>
            </a>
            <a class="quick-action" href="/admin/payments">
              <strong>מעקב אחר עסקאות</strong>
              <span>גישה לכל העסקאות, הסטטוסים והמסמכים שנוצרו.</span>
            </a>
          </div>
        </section>
      </section>
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
    pageTitle: `שגיאה ${input.statusCode}`,
    content: `
      <section class="card status-page">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(input.headline)}</h3>
            <p>${escapeHtml(input.message)}</p>
          </div>
        </div>
        <div class="button-row">
          <a class="button secondary" href="/">חזרה ללוח הבקרה</a>
          <a class="button secondary" href="/admin/payments">מעבר לרשימת העסקאות</a>
        </div>
      </section>
    `
  });
}
