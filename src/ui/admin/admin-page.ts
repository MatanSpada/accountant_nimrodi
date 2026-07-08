import type { Payment } from "../../domain/payments/payment-types";

function formatAmountAgorot(amountAgorot: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS"
  }).format(amountAgorot / 100);
}

function renderRows(payments: Payment[]) {
  if (payments.length === 0) {
    return `
      <tr>
        <td colspan="5" class="empty-state">עדיין לא נוצרו בקשות תשלום. שלב זה משתמש ב-provider מדומה בלבד.</td>
      </tr>
    `;
  }

  return payments
    .map(
      (payment) => `
        <tr>
          <td>${payment.customerName}</td>
          <td>${formatAmountAgorot(payment.amountAgorot)}</td>
          <td>${payment.status}</td>
          <td>${payment.provider}</td>
          <td><a href="${payment.paymentUrl ?? "#"}" target="_blank" rel="noreferrer">קישור</a></td>
        </tr>
      `
    )
    .join("");
}

export function renderAdminPage({ payments }: { payments: Payment[] }) {
  return `<!DOCTYPE html>
  <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>מערכת תשלומים — נמרודי ושות׳</title>
      <style>
        :root {
          --bg: #f3f1eb;
          --surface: #fffdf8;
          --surface-strong: #ffffff;
          --ink: #1f2a37;
          --ink-soft: #5a6775;
          --line: #d9d4ca;
          --brand: #1d3557;
          --brand-soft: #d9e2ee;
          --accent: #8a6f4d;
          --success: #2f6b4f;
          --shadow: 0 18px 50px rgba(24, 35, 52, 0.08);
          --radius: 18px;
          --font: "Noto Sans Hebrew", "Segoe UI", sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: var(--font);
          background:
            radial-gradient(circle at top right, rgba(29, 53, 87, 0.06), transparent 32%),
            linear-gradient(180deg, #f7f4ef 0%, var(--bg) 100%);
          color: var(--ink);
        }

        .layout {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
        }

        .sidebar {
          padding: 32px 24px;
          background: linear-gradient(180deg, #203349 0%, #162432 100%);
          color: #f5f3ef;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
        }

        .brand {
          margin-bottom: 40px;
        }

        .brand small {
          display: block;
          color: rgba(245, 243, 239, 0.72);
          margin-bottom: 8px;
          letter-spacing: 0.08em;
        }

        .brand h1 {
          margin: 0;
          font-size: 1.55rem;
          line-height: 1.3;
        }

        .brand p {
          margin: 12px 0 0;
          color: rgba(245, 243, 239, 0.74);
          line-height: 1.6;
        }

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
          margin-top: 28px;
          padding: 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(245, 243, 239, 0.74);
          line-height: 1.6;
          font-size: 0.95rem;
        }

        main {
          padding: 32px;
        }

        .hero {
          padding: 28px;
          border: 1px solid var(--line);
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(247, 243, 235, 0.9));
          box-shadow: var(--shadow);
          margin-bottom: 24px;
        }

        .hero h2 {
          margin: 0 0 10px;
          font-size: 1.8rem;
        }

        .hero p {
          margin: 0;
          max-width: 60ch;
          color: var(--ink-soft);
          line-height: 1.7;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 24px;
        }

        .card {
          background: var(--surface-strong);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 24px;
        }

        .card h3 {
          margin-top: 0;
          margin-bottom: 8px;
          font-size: 1.2rem;
        }

        .card p {
          margin-top: 0;
          color: var(--ink-soft);
          line-height: 1.7;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .stat {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px;
        }

        .stat strong {
          display: block;
          font-size: 1.2rem;
          margin-bottom: 4px;
          color: var(--brand);
        }

        .mock-form {
          display: grid;
          gap: 12px;
        }

        .mock-form label {
          display: grid;
          gap: 8px;
          font-size: 0.95rem;
          color: var(--ink-soft);
        }

        .mock-form input,
        .mock-form textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--line);
          padding: 12px 14px;
          font: inherit;
          background: #fff;
        }

        .mock-form button {
          border: 0;
          border-radius: 12px;
          padding: 14px 16px;
          font: inherit;
          background: var(--brand);
          color: white;
          cursor: pointer;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th,
        td {
          text-align: right;
          padding: 14px 10px;
          border-bottom: 1px solid var(--line);
          font-size: 0.95rem;
        }

        th {
          color: var(--ink-soft);
          font-weight: 600;
        }

        .empty-state {
          color: var(--ink-soft);
          padding: 22px 10px;
        }

        .todo {
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--brand-soft);
          color: var(--brand);
          font-size: 0.95rem;
        }

        @media (max-width: 960px) {
          .layout,
          .grid,
          .stats {
            grid-template-columns: 1fr;
          }

          .sidebar,
          main {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <div class="brand">
            <small>נמרודי ושות׳ – רואי חשבון</small>
            <h1>מערכת תשלומים</h1>
            <p>תשתית פנימית מסודרת ליצירת בקשות תשלום, מעקב עסקאות והכנה לאינטגרציית בנק וחשבוניות.</p>
          </div>
          <nav>
            <a class="active" href="/">יצירת בקשת תשלום</a>
            <a href="/">עסקאות</a>
            <a href="/">הגדרות</a>
          </nav>
          <div class="sidebar-note">
            שלב 1 משתמש ב-provider מדומה בלבד. אין כרגע חיבור ל-GROW, אין webhooks אמיתיים, ואין אימות משתמשים.
          </div>
        </aside>
        <main>
          <section class="hero">
            <h2>מערכת תשלומים — נמרודי ושות׳</h2>
            <p>
              בסיס ראשוני למערכת אדמין פנימית ב-RTL עברי. המטרה בשלב זה היא לייצב ארכיטקטורה,
              מסד נתונים, ממשקי ספקים ו-UI מנהלי נקי שיכול לקבל בהמשך את הנכסים האמיתיים של המשרד.
            </p>
          </section>

          <section class="grid">
            <div class="card">
              <h3>יצירת בקשת תשלום</h3>
              <p>הטופס כאן הוא מעטפת UI בלבד. את היצירה בפועל בודקים כרגע דרך API mock ולא דרך שליחה ישירה מהעמוד.</p>
              <form class="mock-form">
                <label>
                  שם לקוח
                  <input type="text" placeholder="לדוגמה: אורי כהן" />
                </label>
                <label>
                  טלפון
                  <input type="text" placeholder="050-0000000" />
                </label>
                <label>
                  אימייל
                  <input type="email" placeholder="client@example.com" />
                </label>
                <label>
                  סכום באגורות
                  <input type="number" placeholder="125000" />
                </label>
                <label>
                  תיאור
                  <textarea rows="4" placeholder="שכר טרחה עבור דוח שנתי"></textarea>
                </label>
                <button type="button">יצירת בקשת תשלום</button>
              </form>
              <div class="todo">TODO: להוסיף Authentication והרשאות לפני חשיפת המערכת לשימוש אמיתי.</div>
            </div>

            <div class="card">
              <h3>תמונת מצב</h3>
              <p>הפאזה הנוכחית מתמקדת בהפרדה נכונה בין ראוטים, שירותים, repository ו-provider interfaces.</p>
              <div class="stats">
                <div class="stat">
                  <strong>${payments.length}</strong>
                  רשומות mock
                </div>
                <div class="stat">
                  <strong>Cloudflare</strong>
                  Workers + D1
                </div>
                <div class="stat">
                  <strong>Mock</strong>
                  GROW / חשבוניות
                </div>
              </div>
            </div>
          </section>

          <section class="card" style="margin-top: 24px;">
            <h3>עסקאות אחרונות</h3>
            <p>רשימת עסקאות פנימית לבדיקת הבסיס הארכיטקטוני. בהמשך תתמלא מנתוני D1 ו-webhooks אמיתיים.</p>
            <table>
              <thead>
                <tr>
                  <th>לקוח</th>
                  <th>סכום</th>
                  <th>סטטוס</th>
                  <th>Provider</th>
                  <th>קישור</th>
                </tr>
              </thead>
              <tbody>${renderRows(payments)}</tbody>
            </table>
          </section>
        </main>
      </div>
    </body>
  </html>`;
}
