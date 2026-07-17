# Session Handoff

עדכון אחרון: 2026-07-17

## נקודת עבודה נוכחית

- ענף פעיל: `feature/make-grow-provider`
- קומיט אחרון: `1227e90`
- הודעת קומיט: `add Make-based GROW payment provider`
- מצב working tree בזמן יצירת המסמך: נקי

## מה הושלם

- ה־MVP של phase 8 קיים ועובד.
- יש זרימת `mock-grow` מלאה:
  - יצירת בקשת תשלום
  - קישור דמו
  - סימולציית webhook
  - יצירת מסמך דמו
- נוספה זרימת `make-grow` כספק תשלום ראשון:
  - יצירת קישור דרך Make webhook
  - קבלת webhook ציבורי ב־`/api/grow/webhook`
  - מיפוי סטטוסים שמרני
  - קריאת `Approve Transaction` דרך Make אחרי עדכון תשלום
- נחסמה יצירת קבלה/מסמך דמו עבור `make-grow`, כדי לא לרמוז בטעות שנוצר מסמך אמיתי.

## קבצים שחייבים לקרוא בתחילת סשן חדש

1. [README.md](/home/matan/Documents/accountant_nimrodi/README.md)
2. [SESSION_HANDOFF.md](/home/matan/Documents/accountant_nimrodi/SESSION_HANDOFF.md)
3. [MAKE_GROW_INTEGRATION.md](/home/matan/Documents/accountant_nimrodi/MAKE_GROW_INTEGRATION.md)
4. [CLIENT_REQUIREMENTS.md](/home/matan/Documents/accountant_nimrodi/CLIENT_REQUIREMENTS.md)
5. [DEPLOYMENT_CHECKLIST.md](/home/matan/Documents/accountant_nimrodi/DEPLOYMENT_CHECKLIST.md)
6. [DECISIONS.md](/home/matan/Documents/accountant_nimrodi/DECISIONS.md)

## קבצי קוד מרכזיים להמשך עבודה

- [src/shared/config/app-config.ts](/home/matan/Documents/accountant_nimrodi/src/shared/config/app-config.ts)
- [src/infrastructure/grow/payment-provider-factory.ts](/home/matan/Documents/accountant_nimrodi/src/infrastructure/grow/payment-provider-factory.ts)
- [src/infrastructure/grow/make-grow-payment-provider.ts](/home/matan/Documents/accountant_nimrodi/src/infrastructure/grow/make-grow-payment-provider.ts)
- [src/infrastructure/grow/make-grow-webhook-parser.ts](/home/matan/Documents/accountant_nimrodi/src/infrastructure/grow/make-grow-webhook-parser.ts)
- [src/domain/payments/payment-webhook-service.ts](/home/matan/Documents/accountant_nimrodi/src/domain/payments/payment-webhook-service.ts)
- [src/routes/webhook-routes.ts](/home/matan/Documents/accountant_nimrodi/src/routes/webhook-routes.ts)
- [src/ui/admin/admin-page.ts](/home/matan/Documents/accountant_nimrodi/src/ui/admin/admin-page.ts)

## קבצי בדיקות מרכזיים

- [tests/make-grow-payment-provider.test.ts](/home/matan/Documents/accountant_nimrodi/tests/make-grow-payment-provider.test.ts)
- [tests/make-grow-webhook-service.test.ts](/home/matan/Documents/accountant_nimrodi/tests/make-grow-webhook-service.test.ts)
- [tests/app-routes.test.ts](/home/matan/Documents/accountant_nimrodi/tests/app-routes.test.ts)
- [tests/payment-provider-factory.test.ts](/home/matan/Documents/accountant_nimrodi/tests/payment-provider-factory.test.ts)

## משתני סביבה חשובים

### ברירת מחדל מקומית

```env
APP_ENV=development
DEFAULT_PAYMENT_PROVIDER=mock-grow
GROW_MODE=mock
INVOICE_MODE=mock
ENABLE_DEV_TOOLS=true
ADMIN_PASSWORD=dev-admin-password
SESSION_SECRET=dev-session-secret-change-me
```

### זרימת Make/GROW

```env
DEFAULT_PAYMENT_PROVIDER=make-grow
MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL=...
MAKE_CREATE_PAYMENT_LINK_SECRET=...
MAKE_APPROVE_TRANSACTION_WEBHOOK_URL=...
MAKE_APPROVE_TRANSACTION_SECRET=...
PUBLIC_BASE_URL=https://payments.example
```

## מה עדיין פתוח

- לאמת payload אמיתי שמגיע מ־Make/GROW ל־`/api/grow/webhook`
- לאמת איך להגדיר bank transfer only בתוך מודול GROW של Make
- להחליט על ספק מסמכים אמיתי:
  - GROW
  - או ספק חיצוני
- לאמת אם `invoiceNumber` / `invoiceUrl` קיימים בכלל בזרימה האמיתית

## מה לא לעשות בסשן הבא בלי החלטה מפורשת

- לא למזג ל־`master` אוטומטית
- לא למחוק את `mock-grow`
- לא לטעון שקבלה אמיתית נוצרה בזרימת `make-grow`
- לא להחליף ארכיטקטורה
- לא להטמיע direct GROW API כברירת מחדל

## פקודות מאומתות אחרונות

```bash
npm run format
npm run lint
npm run typecheck
npm test
```

## איך להתחיל סשן חדש

```bash
cd /home/matan/Documents/accountant_nimrodi
git checkout feature/make-grow-provider
git pull --ff-only origin feature/make-grow-provider
```

ואז לקרוא לפי הסדר:

1. `SESSION_HANDOFF.md`
2. `README.md`
3. `MAKE_GROW_INTEGRATION.md`

## המלצת prompt קצרה לסשן הבא

```text
You are working in /home/matan/Documents/accountant_nimrodi on branch feature/make-grow-provider.
Start by reading SESSION_HANDOFF.md, README.md, MAKE_GROW_INTEGRATION.md, CLIENT_REQUIREMENTS.md, and the current payment provider/webhook files before making changes.
Preserve mock-grow behavior. Keep make-grow as the recommended integration path. Do not claim real invoice creation unless a real invoice provider exists.
```
