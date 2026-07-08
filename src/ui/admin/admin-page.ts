import type { PaymentListResult } from "../../domain/payments/payment-repository";
import type { Payment } from "../../domain/payments/payment-types";
import { CLIENT_REQUIREMENTS_ITEMS } from "./client-requirements";
import { escapeHtml, formatAmountAgorot, formatDateTime } from "./formatters";
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
            שלב 3 עדיין עובד עם provider מדומה בלבד. שליחת הקישור ללקוח נעשית ידנית, כולל פתיחת WhatsApp דרך קישור עזר.
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
      </script>
    </body>
  </html>`;
}

function renderPaymentRows(payments: Payment[]) {
  if (payments.length === 0) {
    return `
      <tr>
        <td colspan="7">
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

export function renderPaymentDetailsPage(input: { payment: Payment }) {
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
        <p>אפשר להעתיק את הקישור, לפתוח הודעת WhatsApp ידנית, ולעיין בכל פרטי העסקה כפי שנשמרו במערכת.</p>
      </section>
      <section class="card">
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
