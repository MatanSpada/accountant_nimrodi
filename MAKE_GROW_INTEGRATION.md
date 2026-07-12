# GROW דרך Make

## למה בחרנו ב־Make

- ה־API הישיר של GROW כרוך בעלות חודשית שאינה מתאימה ל־MVP הנוכחי.
- Make משמש שכבת חיבור בין המערכת שלנו לבין GROW באמצעות האפליקציה הרשמית של GROW בתוך Make.
- במסלול הזה אין צורך להתחיל מייד עם `userId` / `pageCode` / API key ישיר של GROW בתוך האפליקציה שלנו.

## מה נדרש מהלקוח

- חשבון GROW בבעלות הלקוח
- מספר טלפון המחובר לחשבון GROW לצורך קוד אימות אם נדרש
- חשבון Make של הלקוח או של הפרויקט
- כתובת פריסה ציבורית של המערכת ב־Cloudflare לצורך `notify_url`

## תרחיש 1 — יצירת קישור תשלום

Trigger ב־Make:

- Custom webhook

Action ב־Make:

- GROW → Create Payment Link

המערכת שלנו שולחת ל־Make payload כגון:

```json
{
  "payment_id": "pay_123",
  "customer_name": "לקוח לדוגמה",
  "customer_email": "customer@example.com",
  "customer_phone": "0501234567",
  "amount_agorot": 123456,
  "amount_ils": 1234.56,
  "currency": "ILS",
  "description": "שכר טרחה",
  "send_method": "none",
  "allowed_payment_methods": ["bank_transfer"],
  "notify_url": "https://payments.example/api/grow/webhook",
  "metadata": {
    "source": "accountant_nimrodi",
    "payment_id": "pay_123"
  }
}
```

הנחיות ל־Make:

- לבחור `send method = none` / `ללא` כדי שהקישור יחזור אלינו ולא יישלח ישירות מהמערכת של GROW
- להגדיר תשלום בהעברה בנקאית בלבד, אם זה אכן נתמך בשדה המתאים של מודול GROW
- להעביר בחזרה ב־Webhook response לפחות:
  - `payment_url`
  - `provider_payment_id`
  - `transaction_id` אם קיים

## תרחיש 2 — Approve Transaction

Trigger ב־Make:

- Custom webhook מהאפליקציה שלנו

Action ב־Make:

- GROW → Approve Transaction

מטרת התרחיש:

- לעצור התראות חוזרות של GROW לאחר שהתשלום עובד ונשמר אצלנו

המערכת שלנו שולחת ל־Make:

- ה־payload המקורי שהתקבל מהתראת התשלום
- `payment_id` הפנימי שלנו
- מזהי ספק שנשמרו על התשלום, אם קיימים

## משתני סביבה נדרשים

```env
DEFAULT_PAYMENT_PROVIDER=make-grow
MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL=...
MAKE_CREATE_PAYMENT_LINK_SECRET=...
MAKE_APPROVE_TRANSACTION_WEBHOOK_URL=...
MAKE_APPROVE_TRANSACTION_SECRET=...
PUBLIC_BASE_URL=https://payments.example
```

שאר סודות האדמין נשארים ללא שינוי:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## נקודות פתוחות לפני ייצור

- לאשר מהו השדה המדויק ב־Make/GROW להגבלת אמצעי התשלום להעברה בנקאית בלבד
- לאשר את מבנה ה־payload הסופי שמגיע מהתראת תשלום אמיתית
- לאשר האם מסמכים/קבלות אוטומטיים זמינים דרך GROW ומה העלות שלהם
- לאשר האם `invoiceNumber` ו־`invoiceUrl` חוזרים ב־webhook או נדרשת אינטגרציית מסמכים נפרדת
