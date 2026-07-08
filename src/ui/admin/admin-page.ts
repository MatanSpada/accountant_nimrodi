import type { InvoiceRecord } from "../../domain/invoices/invoice-types";
import type { PaymentListResult } from "../../domain/payments/payment-repository";
import { isFinalPaymentStatus } from "../../domain/payments/payment-status";
import type { Payment } from "../../domain/payments/payment-types";
import type { PaymentWebhookRecord } from "../../domain/payments/payment-webhook-types";
import { CLIENT_REQUIREMENTS_ITEMS } from "./client-requirements";
import { escapeHtml, formatAmountAgorot, formatDateTime } from "./formatters";
import { getInvoiceStatusLabel } from "./invoice-status-labels";
import { getPaymentStatusLabel } from "./status-labels";
import { buildWhatsAppLink } from "./whatsapp-helper";

function renderLayout(input: {
  title: string;
  activePath: "dashboard" | "new-payment" | "payments" | "settings";
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
      label: "יצירת בקשת תשלום"
    },
    {
      key: "payments",
      href: "/admin/payments",
      label: "עסקאות"
    },
    {
      key: "settings",
      href: "/admin/settings/client-requirements",
      label: "הגדרות / דרישות חסרות"
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
          --bg: #f3f1eb;
          --surface: #fffdf8;
          --surface-strong: #ffffff;
          --surface-soft: #f7f2e9;
          --ink: #1f2a37;
          --ink-soft: #5a6775;
          --line: #d9d4ca;
          --brand: #1d3557;
          --brand-soft: #d9e2ee;
          --accent: #8a6f4d;
          --success: #2f6b4f;
          --warning: #9d6c2d;
          --danger: #8f3d3d;
          --shadow: 0 18px 50px rgba(24, 35, 52, 0.08);
          --radius: 18px;
          --font: "Noto Sans Hebrew", "Segoe UI", sans-serif;
        }

        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: var(--font);
          background:
            radial-gradient(circle at top right, rgba(29, 53, 87, 0.06), transparent 32%),
            linear-gradient(180deg, #f7f4ef 0%, var(--bg) 100%);
          color: var(--ink);
        }
        a { color: var(--brand); }
        .layout { min-height: 100vh; display: grid; grid-template-columns: 290px minmax(0, 1fr); }
        .sidebar {
          padding: 32px 24px;
          background: linear-gradient(180deg, #203349 0%, #162432 100%);
          color: #f5f3ef;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
        }
        .brand { margin-bottom: 32px; }
        .brand small {
          display: block;
          color: rgba(245, 243, 239, 0.72);
          margin-bottom: 8px;
          letter-spacing: 0.08em;
        }
        .brand h1 { margin: 0; font-size: 1.55rem; line-height: 1.3; }
        .brand p { margin: 12px 0 0; color: rgba(245, 243, 239, 0.74); line-height: 1.6; }
        nav a {
          display: block;
          margin-bottom: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          color: inherit;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        nav a.active {
          background: rgba(217, 226, 238, 0.14);
          border-color: rgba(217, 226, 238, 0.26);
        }
        .sidebar-note {
          margin-top: 24px;
          padding: 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(245, 243, 239, 0.74);
          line-height: 1.6;
          font-size: 0.95rem;
        }
        main { padding: 32px; }
        .hero {
          padding: 28px;
          border: 1px solid var(--line);
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(247, 243, 235, 0.9));
          box-shadow: var(--shadow);
          margin-bottom: 24px;
        }
        .hero h2 { margin: 0 0 10px; font-size: 1.8rem; }
        .hero p { margin: 0; max-width: 60ch; color: var(--ink-soft); line-height: 1.7; }
        .grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 24px; }
        .card {
          background: var(--surface-strong);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 24px;
        }
        .card h3 { margin: 0 0 8px; font-size: 1.2rem; }
        .card p { margin: 0 0 12px; color: var(--ink-soft); line-height: 1.7; }
        .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
        .stat { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
        .stat strong { display: block; font-size: 1.2rem; margin-bottom: 4px; color: var(--brand); }
        .quick-links { display: grid; gap: 12px; }
        .quick-links a {
          display: block;
          padding: 16px 18px;
          background: var(--surface-soft);
          border: 1px solid var(--line);
          border-radius: 14px;
          text-decoration: none;
        }
        .quick-links strong { display: block; margin-bottom: 6px; color: var(--ink); }
        .quick-links span { color: var(--ink-soft); font-size: 0.95rem; }
        .form-grid { display: grid; gap: 16px; }
        .form-grid.two-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        label { display: grid; gap: 8px; color: var(--ink-soft); font-size: 0.95rem; }
        input, textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--line);
          padding: 12px 14px;
          font: inherit;
          background: #fff;
          color: var(--ink);
        }
        textarea { resize: vertical; min-height: 120px; }
        .button-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
        .button, button {
          border: 0;
          border-radius: 12px;
          padding: 14px 16px;
          font: inherit;
          background: var(--brand);
          color: white;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .button.secondary {
          background: var(--surface-soft);
          color: var(--ink);
          border: 1px solid var(--line);
        }
        .button.whatsapp { background: var(--success); }
        .inline-code {
          direction: ltr;
          display: inline-block;
          background: var(--surface-soft);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 6px 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.92rem;
          word-break: break-all;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: var(--brand-soft);
          color: var(--brand);
          font-size: 0.9rem;
        }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td {
          text-align: right;
          padding: 14px 10px;
          border-bottom: 1px solid var(--line);
          font-size: 0.95rem;
          vertical-align: top;
        }
        th { color: var(--ink-soft); font-weight: 600; }
        .empty-state {
          color: var(--ink-soft);
          padding: 22px 10px;
          background: var(--surface-soft);
          border: 1px dashed var(--line);
          border-radius: 14px;
        }
        .note, .todo {
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--brand-soft);
          color: var(--brand);
          font-size: 0.95rem;
          line-height: 1.6;
        }
        .error-box {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          background: #f9e3e3;
          color: var(--danger);
          border: 1px solid #ebc5c5;
        }
        .success-box {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          background: #e6f2eb;
          color: var(--success);
          border: 1px solid #c7dfd1;
        }
        .warning-box {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          background: #f7eddc;
          color: var(--warning);
          border: 1px solid #e8d7b2;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 16px;
        }
        .detail {
          padding: 16px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: var(--surface);
        }
        .detail strong {
          display: block;
          margin-bottom: 6px;
          color: var(--ink-soft);
          font-size: 0.9rem;
        }
        .requirements-list {
          margin: 0;
          padding: 0 20px 0 0;
          display: grid;
          gap: 10px;
        }
        .requirements-list li {
          line-height: 1.7;
          color: var(--ink);
        }
        .pagination {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
        }
        .pagination a {
          text-decoration: none;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--surface-soft);
        }
        .page-kicker {
          color: var(--ink-soft);
          margin-bottom: 8px;
          font-size: 0.95rem;
        }
        .copy-feedback {
          color: var(--success);
          font-size: 0.95rem;
        }
        .webhook-list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }
        .webhook-item {
          padding: 16px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: var(--surface);
        }
        .webhook-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .webhook-error {
          margin-top: 10px;
          color: var(--danger);
        }
        .card-stack {
          display: grid;
          gap: 24px;
        }
        @media (max-width: 960px) {
          .layout, .grid, .stats, .form-grid.two-columns, .details-grid {
            grid-template-columns: 1fr;
          }
          .sidebar, main { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <div class="brand">
            <small>נמרודי ושות׳ – רואי חשבון</small>
            <h1>מערכת תשלומים</h1>
            <p>יצירת בקשות תשלום בהעברה בנקאית ושליחת קישור ללקוח.</p>
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
          <div class="sidebar-note">
            שלב 5 עדיין עובד עם providers מדומים בלבד. תשלום ששולם יכול כעת להפעיל גם יצירת קבלה מדומה, בלי להתחבר עדיין ל-GROW או לספק מסמכים אמיתי.
          </div>
        </aside>
        <main>
          ${
            input.pageTitle
              ? `<div class="page-kicker">${escapeHtml(input.pageTitle)}</div>`
              : ""
          }
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

          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(text);
              if (feedback) feedback.textContent = "הקישור הועתק.";
            } else {
              if (feedback) feedback.textContent = "העתקה אוטומטית לא נתמכת בדפדפן זה.";
            }
          } catch (error) {
            if (feedback) feedback.textContent = "לא ניתן היה להעתיק את הקישור.";
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
                  data.message || "סימולציית ה-webhook הסתיימה."
                )
              });
            } else {
              const endpoint = target.getAttribute("data-endpoint");
              if (!endpoint) {
                throw new Error("חסר endpoint ליצירת קבלה מדומה.");
              }

              const response = await fetch(endpoint, {
                method: "POST"
              });
              const data = await response.json();

              query = new URLSearchParams({
                invoice_outcome: String(data.outcome || "failed"),
                invoice_message: String(
                  data.message || "ניסיון יצירת הקבלה הסתיים."
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
                  ? "לא ניתן היה לשלוח את ה-webhook המדומה."
                  : "לא ניתן היה ליצור קבלה מדומה.";
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

function renderSimulatorForms(payment: Payment, redirectPath: string) {
  if (isFinalPaymentStatus(payment.status)) {
    return `
      <div class="note">
        העסקה כבר נמצאת בסטטוס סופי. כדי לבדוק duplicate-safe behavior אפשר לשלוח שוב את אותו event_id דרך ה-API או דרך עמוד התשלום המדומה.
      </div>
    `;
  }

  const statuses = [
    { eventType: "payment.paid", status: "paid", label: "סימולציה: שולם" },
    { eventType: "payment.failed", status: "failed", label: "סימולציה: נכשל" },
    {
      eventType: "payment.cancelled",
      status: "cancelled",
      label: "סימולציה: בוטל"
    },
    {
      eventType: "payment.expired",
      status: "expired",
      label: "סימולציה: פג תוקף"
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
              <button type="submit">${label}</button>
            </form>
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
        עדיין לא התקבלו webhook-ים עבור העסקה הזאת.
      </div>
    `;
  }

  return `
    <div class="webhook-list">
      ${webhooks
        .map(
          (webhook) => `
            <div class="webhook-item">
              <div class="webhook-meta">
                <span class="status-badge">${escapeHtml(webhook.eventType)}</span>
                <span class="status-badge">${escapeHtml(webhook.processingStatus)}</span>
                <span>${formatDateTime(webhook.receivedAt)}</span>
              </div>
              <div><strong>Provider event ID</strong> ${escapeHtml(webhook.providerEventId ?? "—")}</div>
              <div><strong>Provider transaction ID</strong> ${escapeHtml(webhook.providerTransactionId ?? "—")}</div>
              <div><strong>עובד בתאריך</strong> ${formatDateTime(webhook.processedAt)}</div>
              ${
                webhook.processingError
                  ? `<div class="webhook-error"><strong>שגיאה</strong> ${escapeHtml(webhook.processingError)}</div>`
                  : ""
              }
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderInvoiceIndicator(payment: Payment) {
  return payment.invoiceId ? "קבלה נוצרה" : "אין קבלה";
}

function renderInvoiceSection(input: {
  payment: Payment;
  invoice: InvoiceRecord | null;
}) {
  if (!input.invoice) {
    return `
      <p>לא נוצרה קבלה עדיין.</p>
      ${
        input.payment.status === "paid"
          ? `
            <form method="post" data-mock-invoice-form data-endpoint="/api/payments/${escapeHtml(input.payment.id)}/invoice/mock" data-redirect="/admin/payments/${escapeHtml(input.payment.id)}">
              <button type="submit">צור/נסה שוב קבלה מדומה</button>
            </form>
            <div class="note">פעולת retry זמינה רק לצורכי פיתוח ואינה מייצגת flow production סופי.</div>
          `
          : ""
      }
    `;
  }

  const canRetry =
    input.payment.status === "paid" &&
    (input.invoice.status === "failed" || input.invoice.status === "pending");

  return `
    <div class="details-grid">
      <div class="detail"><strong>סטטוס קבלה</strong>${getInvoiceStatusLabel(input.invoice.status)}</div>
      <div class="detail"><strong>Provider</strong>${escapeHtml(input.invoice.provider)}</div>
      <div class="detail"><strong>מספר מסמך</strong>${escapeHtml(input.invoice.invoiceNumber ?? "—")}</div>
      <div class="detail"><strong>Provider Invoice ID</strong>${escapeHtml(input.invoice.providerInvoiceId ?? "—")}</div>
      <div class="detail"><strong>קישור למסמך</strong>${
        input.invoice.invoiceUrl
          ? `<a href="${escapeHtml(input.invoice.invoiceUrl)}" target="_blank" rel="noreferrer">פתיחת מסמך מדומה</a>`
          : "—"
      }</div>
      <div class="detail"><strong>נוצר בתאריך</strong>${formatDateTime(input.invoice.createdAt)}</div>
      <div class="detail"><strong>עודכן בתאריך</strong>${formatDateTime(input.invoice.updatedAt)}</div>
      <div class="detail"><strong>שגיאה אחרונה</strong>${escapeHtml(input.invoice.failureReason ?? "—")}</div>
    </div>
    ${
      canRetry
        ? `
          <div class="button-row">
            <form method="post" data-mock-invoice-form data-endpoint="/api/payments/${escapeHtml(input.payment.id)}/invoice/mock" data-redirect="/admin/payments/${escapeHtml(input.payment.id)}">
              <button type="submit">צור/נסה שוב קבלה מדומה</button>
            </form>
          </div>
          <div class="note">המערכת תשאיר את התשלום במצב שולם גם אם הניסיון הבא ליצירת קבלה ייכשל.</div>
        `
        : ""
    }
  `;
}

function renderPaymentRows(payments: Payment[]) {
  if (payments.length === 0) {
    return `
      <tr>
        <td colspan="8">
          <div class="empty-state">עדיין לא נוצרו בקשות תשלום. אפשר להתחיל מיצירת בקשה חדשה.</div>
        </td>
      </tr>
    `;
  }

  return payments
    .map(
      (payment) => `
        <tr>
          <td>${formatDateTime(payment.createdAt)}</td>
          <td>${escapeHtml(payment.customerName)}</td>
          <td>${escapeHtml(payment.customerPhone ?? "—")}</td>
          <td>${formatAmountAgorot(payment.amountAgorot)}</td>
          <td><span class="status-badge">${getPaymentStatusLabel(payment.status)}</span></td>
          <td>${renderInvoiceIndicator(payment)}</td>
          <td>${
            payment.paymentUrl
              ? `<a href="${escapeHtml(payment.paymentUrl)}" target="_blank" rel="noreferrer">פתיחת קישור</a>`
              : "—"
          }</td>
          <td><a href="/admin/payments/${payment.id}">פרטים</a></td>
        </tr>
      `
    )
    .join("");
}

export function renderDashboardPage(input: { payments: Payment[] }) {
  return renderLayout({
    title: "מערכת תשלומים — נמרודי ושות׳",
    activePath: "dashboard",
    content: `
      <section class="hero">
        <h2>מערכת תשלומים — נמרודי ושות׳</h2>
        <p>יצירת בקשות תשלום בהעברה בנקאית ושליחת קישור ללקוח. בשלב זה הקישור מדומה, אך נשמר במסד ומאפשר בדיקה מלאה של תהליך העבודה הפנימי.</p>
      </section>
      <section class="grid">
        <div class="card">
          <h3>פעולות זמינות</h3>
          <p>המערכת מאפשרת לייצר בקשת תשלום, להעתיק את הקישור, לפתוח הודעת WhatsApp ידנית ולעקוב אחרי העסקאות שכבר נוצרו.</p>
          <div class="quick-links">
            <a href="/admin/payments/new">
              <strong>יצירת בקשת תשלום</strong>
              <span>פתיחת טופס והפקת קישור mock חדש.</span>
            </a>
            <a href="/admin/payments">
              <strong>עסקאות</strong>
              <span>מעבר לרשימת התשלומים שנוצרו במערכת.</span>
            </a>
            <a href="/admin/settings/client-requirements">
              <strong>הגדרות / דרישות חסרות</strong>
              <span>מה עדיין חסר מהלקוח לפני מעבר ל-production.</span>
            </a>
          </div>
        </div>
        <div class="card">
          <h3>תמונת מצב</h3>
          <p>המערכת מחוברת כבר ל-D1 המקומי, אך עדיין לא מחוברת ל-GROW אמיתי ולא ל-WhatsApp API.</p>
          <div class="stats">
            <div class="stat">
              <strong>${input.payments.length}</strong>
              עסקאות אחרונות
            </div>
            <div class="stat">
              <strong>Mock</strong>
              provider פעיל
            </div>
            <div class="stat">
              <strong>D1</strong>
              persistence פעיל
            </div>
          </div>
        </div>
      </section>
      <section class="card" style="margin-top: 24px;">
        <h3>עסקאות אחרונות</h3>
        <p>מבט מהיר על העסקאות האחרונות שנוצרו במערכת.</p>
        <table>
          <thead>
            <tr>
              <th>נוצר בתאריך</th>
              <th>לקוח</th>
              <th>טלפון</th>
              <th>סכום</th>
              <th>סטטוס</th>
              <th>קבלה</th>
              <th>קישור</th>
              <th>פעולה</th>
            </tr>
          </thead>
          <tbody>${renderPaymentRows(input.payments)}</tbody>
        </table>
      </section>
    `
  });
}

export function renderNewPaymentPage(input: {
  errorMessage?: string | null;
  formValues?: Record<string, string>;
}) {
  const values = input.formValues ?? {};

  return renderLayout({
    title: "יצירת בקשת תשלום — נמרודי ושות׳",
    activePath: "new-payment",
    pageTitle: "יצירת בקשת תשלום",
    content: `
      <section class="hero">
        <h2>יצירת בקשת תשלום</h2>
        <p>המערכת תיצור קישור mock ותשמור את העסקה ב-D1. לאחר היצירה יוצגו פרטי הקישור, מזהי ה-provider וכפתורי העתקה ו-WhatsApp.</p>
      </section>
      <section class="card">
        <h3>פרטי הבקשה</h3>
        <p>הסכום מוזן בשקלים מטעמי נוחות, וההמרה לאגורות מתבצעת בצד השרת.</p>
        ${
          input.errorMessage
            ? `<div class="error-box">${escapeHtml(input.errorMessage)}</div>`
            : ""
        }
        <form id="payment-form" class="form-grid" method="post" action="/api/payments">
          <div class="form-grid two-columns">
            <label>
              שם לקוח
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
            תיאור
            <textarea name="description" required placeholder="שכר טרחה עבור דוח שנתי">${escapeHtml(values.description ?? "")}</textarea>
          </label>
          <div class="button-row">
            <button type="submit">יצירת בקשת תשלום</button>
            <a class="button secondary" href="/admin/payments">מעבר לרשימת עסקאות</a>
          </div>
          <div class="note">אם JavaScript פעיל, השליחה תתבצע דרך ה-API ותעביר אוטומטית לעמוד פרטי העסקה שנוצרה.</div>
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

export function renderPaymentsListPage(input: { payments: PaymentListResult }) {
  const previousOffset = Math.max(
    0,
    input.payments.offset - input.payments.limit
  );
  const nextOffset = input.payments.offset + input.payments.limit;

  return renderLayout({
    title: "עסקאות — נמרודי ושות׳",
    activePath: "payments",
    pageTitle: "עסקאות",
    content: `
      <section class="hero">
        <h2>רשימת עסקאות</h2>
        <p>רשימה פנימית של בקשות התשלום שנוצרו במערכת. סינונים מתקדמים יתווספו בהמשך לפי סטטוס, תאריך ופרטי לקוח.</p>
      </section>
      <section class="card">
        <div class="button-row" style="margin-top: 0; margin-bottom: 10px;">
          <a class="button" href="/admin/payments/new">יצירת בקשת תשלום</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>נוצר בתאריך</th>
              <th>לקוח</th>
              <th>טלפון</th>
              <th>סכום</th>
              <th>סטטוס</th>
              <th>קבלה</th>
              <th>קישור</th>
              <th>פעולה</th>
            </tr>
          </thead>
          <tbody>${renderPaymentRows(input.payments.items)}</tbody>
        </table>
        <div class="todo">TODO: להוסיף סינון לפי סטטוס, טווח תאריכים ופרטי לקוח כאשר נצבור יותר עסקאות.</div>
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
    title: `בקשת תשלום ${input.payment.id} — נמרודי ושות׳`,
    activePath: "payments",
    pageTitle: "פרטי עסקה",
    content: `
      <section class="hero">
        <h2>פרטי בקשת תשלום</h2>
        <p>אפשר להעתיק את הקישור, לפתוח הודעת WhatsApp ידנית, ולעיין בפרטי העסקה ובאירועי ה-webhook שנשמרו במערכת.</p>
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
          <h3>${escapeHtml(input.payment.customerName)}</h3>
          <p><span class="status-badge">${getPaymentStatusLabel(input.payment.status)}</span></p>
          <div class="details-grid">
            <div class="detail"><strong>סכום</strong>${formatAmountAgorot(input.payment.amountAgorot)}</div>
            <div class="detail"><strong>תיאור</strong>${escapeHtml(input.payment.description)}</div>
            <div class="detail"><strong>טלפון</strong>${escapeHtml(input.payment.customerPhone ?? "—")}</div>
            <div class="detail"><strong>אימייל</strong>${escapeHtml(input.payment.customerEmail ?? "—")}</div>
            <div class="detail"><strong>סטטוס פנימי</strong>${escapeHtml(input.payment.status)}</div>
            <div class="detail"><strong>סטטוס להצגה</strong>${getPaymentStatusLabel(input.payment.status)}</div>
            <div class="detail"><strong>Provider</strong>${escapeHtml(input.payment.provider)}</div>
            <div class="detail"><strong>Provider Payment ID</strong>${escapeHtml(input.payment.providerPaymentId ?? "—")}</div>
            <div class="detail"><strong>Provider Transaction ID</strong>${escapeHtml(input.payment.providerTransactionId ?? "—")}</div>
            <div class="detail"><strong>Invoice ID</strong>${escapeHtml(input.payment.invoiceId ?? "—")}</div>
            <div class="detail"><strong>נוצר בתאריך</strong>${formatDateTime(input.payment.createdAt)}</div>
            <div class="detail"><strong>עודכן בתאריך</strong>${formatDateTime(input.payment.updatedAt)}</div>
            <div class="detail"><strong>שולם בתאריך</strong>${formatDateTime(input.payment.paidAt)}</div>
            <div class="detail"><strong>בוטל בתאריך</strong>${formatDateTime(input.payment.cancelledAt)}</div>
            <div class="detail"><strong>נכשל בתאריך</strong>${formatDateTime(input.payment.failedAt)}</div>
            <div class="detail"><strong>קישור לתשלום</strong>${
              input.payment.paymentUrl
                ? `<div class="inline-code">${escapeHtml(input.payment.paymentUrl)}</div>`
                : "—"
            }</div>
          </div>
          <div class="button-row">
            ${
              input.payment.paymentUrl
                ? `
                  <button
                    type="button"
                    data-copy-text="${escapeHtml(input.payment.paymentUrl)}"
                    data-copy-feedback="copy-feedback"
                  >
                    העתקת קישור
                  </button>
                  <span id="copy-feedback" class="copy-feedback" aria-live="polite"></span>
                  <a class="button secondary" href="${escapeHtml(input.payment.paymentUrl)}" target="_blank" rel="noreferrer">פתיחת עמוד תשלום מדומה</a>
                `
                : ""
            }
            ${
              whatsappLink
                ? `<a class="button whatsapp" href="${escapeHtml(whatsappLink)}" target="_blank" rel="noreferrer">פתיחת WhatsApp</a>`
                : `<div class="note">WhatsApp זמין רק כאשר יש טלפון תקין וקישור תשלום קיים.</div>`
            }
            <a class="button secondary" href="/admin/payments">חזרה לרשימת העסקאות</a>
          </div>
        </section>
        <section class="card">
          <h3>סימולטור פיתוח — לא GROW אמיתי</h3>
          <p>הכפתורים למטה שולחים payload מדומה ל-<span class="inline-code">/api/mock-grow/webhook</span> כדי לבדוק את שרשרת העדכון: שמירת webhook, אימות, ועדכון סטטוס התשלום.</p>
          ${renderSimulatorForms(input.payment, `/admin/payments/${input.payment.id}`)}
          <div class="note">אין כאן schema אמיתי של GROW. המימוש הסופי יתבצע רק לאחר קבלת payloads מאומתים מהחשבון של הלקוח.</div>
        </section>
        <section class="card">
          <h3>קבלה / מסמך</h3>
          <p>כאשר התשלום מסומן כשולם, המערכת מנסה ליצור מסמך מדומה בדיוק פעם אחת. duplicate webhook לא אמור ליצור מסמך נוסף.</p>
          ${renderInvoiceSection({
            payment: input.payment,
            invoice: input.invoice
          })}
        </section>
        <section class="card">
          <h3>Webhook-ים אחרונים</h3>
          <p>תצוגת audit פשוטה של אירועי webhook שנשמרו עבור העסקה הזאת.</p>
          ${renderWebhookRecords(input.webhooks)}
        </section>
      </div>
    `
  });
}

export function renderMockGrowPaymentPage(input: {
  payment: Payment;
  webhooks: PaymentWebhookRecord[];
}) {
  return renderLayout({
    title: `עמוד תשלום מדומה ${input.payment.id} — נמרודי ושות׳`,
    activePath: "payments",
    pageTitle: "עמוד תשלום מדומה",
    content: `
      <section class="hero">
        <h2>עמוד תשלום מדומה — לצורכי פיתוח בלבד</h2>
        <p>זהו עמוד סימולציה מקומי בלבד. הוא לא משקף את חוויית GROW האמיתית ולא את payload ה-webhook האמיתי.</p>
      </section>
      <div class="card-stack">
        <section class="card">
          <h3>${escapeHtml(input.payment.customerName)}</h3>
          <p><span class="status-badge">${getPaymentStatusLabel(input.payment.status)}</span></p>
          <div class="details-grid">
            <div class="detail"><strong>Provider Payment ID</strong>${escapeHtml(input.payment.providerPaymentId ?? "—")}</div>
            <div class="detail"><strong>Provider Transaction ID</strong>${escapeHtml(input.payment.providerTransactionId ?? "—")}</div>
            <div class="detail"><strong>סכום</strong>${formatAmountAgorot(input.payment.amountAgorot)}</div>
            <div class="detail"><strong>תיאור</strong>${escapeHtml(input.payment.description)}</div>
          </div>
        </section>
        <section class="card">
          <h3>פעולות סימולציה</h3>
          <p>הכפתורים שולחים webhook מדומה לשרת. זו הדרך שבה בודקים את הזרימה הקריטית בשלב זה.</p>
          ${renderSimulatorForms(
            input.payment,
            `/dev/mock-grow/pay/${input.payment.providerPaymentId ?? ""}`
          )}
        </section>
        <section class="card">
          <h3>Webhook-ים אחרונים</h3>
          ${renderWebhookRecords(input.webhooks)}
          <div class="button-row">
            <a class="button secondary" href="/admin/payments/${input.payment.id}">מעבר לפרטי העסקה במערכת</a>
          </div>
        </section>
      </div>
    `
  });
}

export function renderMockInvoicePage(input: {
  invoice: InvoiceRecord;
  payment: Payment;
}) {
  return renderLayout({
    title: `מסמך מדומה ${input.invoice.invoiceNumber ?? input.invoice.id} — נמרודי ושות׳`,
    activePath: "payments",
    pageTitle: "מסמך מדומה",
    content: `
      <section class="hero">
        <h2>מסמך מדומה — לצורכי פיתוח בלבד</h2>
        <p>העמוד הזה אינו מסמך חשבונאי או משפטי. הוא קיים רק כדי לאמת את זרימת הפיתוח של יצירת קבלה לאחר תשלום.</p>
      </section>
      <section class="card">
        <h3>${escapeHtml(input.invoice.invoiceNumber ?? input.invoice.id)}</h3>
        <p><span class="status-badge">${getInvoiceStatusLabel(input.invoice.status)}</span></p>
        <div class="details-grid">
          <div class="detail"><strong>Payment ID</strong>${escapeHtml(input.payment.id)}</div>
          <div class="detail"><strong>Provider Invoice ID</strong>${escapeHtml(input.invoice.providerInvoiceId ?? "—")}</div>
          <div class="detail"><strong>לקוח</strong>${escapeHtml(input.payment.customerName)}</div>
          <div class="detail"><strong>סכום</strong>${formatAmountAgorot(input.payment.amountAgorot)}</div>
          <div class="detail"><strong>תיאור</strong>${escapeHtml(input.payment.description)}</div>
          <div class="detail"><strong>סטטוס</strong>${getInvoiceStatusLabel(input.invoice.status)}</div>
          <div class="detail"><strong>נוצר בתאריך</strong>${formatDateTime(input.invoice.createdAt)}</div>
          <div class="detail"><strong>עודכן בתאריך</strong>${formatDateTime(input.invoice.updatedAt)}</div>
        </div>
        <div class="note">סוג המסמך הסופי, התנהגות המע״מ והפורמט החוקי יוגדרו רק לאחר קבלת הנחיות מהלקוח ומהרואה חשבון.</div>
        <div class="button-row">
          <a class="button secondary" href="/admin/payments/${escapeHtml(input.payment.id)}">חזרה לפרטי העסקה</a>
        </div>
      </section>
    `
  });
}

export function renderClientRequirementsPage() {
  return renderLayout({
    title: "דרישות חסרות — נמרודי ושות׳",
    activePath: "settings",
    pageTitle: "הגדרות / דרישות חסרות",
    content: `
      <section class="hero">
        <h2>דרישות חסרות לפני מעבר לאינטגרציה אמיתית</h2>
        <p>העמוד הזה נשאר גלוי בכוונה כדי לייצר שקיפות לגבי מה עדיין חסר מהלקוח לפני מעבר ל-GROW אמיתי ול-production.</p>
      </section>
      <section class="card">
        <h3>Checklist פתוח</h3>
        <ul class="requirements-list">
          ${CLIENT_REQUIREMENTS_ITEMS.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <div class="note">בשלב זה אין אינטגרציית GROW אמיתית, אין Meta approval ל-WhatsApp API, ואין אימות משתמשים.</div>
      </section>
    `
  });
}
