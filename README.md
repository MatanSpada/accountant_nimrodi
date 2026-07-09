# מערכת תשלומים פנימית — נמרודי ושות׳

Phase 6/8 of an internal payment-request system for "נמרודי ושות׳ – רואי חשבון".

The long-term business flow is:

1. Internal admin user creates a payment request for a customer.
2. The system creates a provider payment request and returns a payment link.
3. The office manually sends the link to the customer.
4. Webhooks later update the payment status.
5. A receipt/invoice attempt is triggered after a paid webhook.

This phase still does **not** connect to real GROW or any real invoice provider. It adds admin authentication, environment validation, dev-tool gating, Cloudflare deployment preparation, and production-readiness checks on top of the existing mock payment/webhook/invoice flow.

## Current phase status

- Cloudflare Workers + Hono foundation is active.
- D1-backed repositories persist customers, payments, webhook records, and invoice records.
- Internal admin UI supports:
  - dashboard
  - new payment form
  - payments list
  - payment details page
  - client requirements page
- Admin login at `/login` now protects internal admin pages and internal payment APIs.
- A user can create a mock payment link from the admin UI, copy it, and open a manual WhatsApp link.
- A user can simulate `paid`, `failed`, `cancelled`, and `expired` webhook outcomes from the admin UI or the mock payment page.
- A successful `paid` webhook triggers exactly one mock invoice attempt.
- Duplicate paid webhook delivery does not create a second invoice.
- Development-only endpoints are gated by `ENABLE_DEV_TOOLS`.
- `/api/grow/webhook` is intentionally reserved and returns `501 Not Implemented` until verified real GROW payloads are available.

## Tech stack

- TypeScript
- Cloudflare Workers
- Hono
- Cloudflare D1
- Wrangler
- Vitest
- ESLint
- Prettier

## Domain status meanings

### Payment statuses

- `draft`: internal record created before provider details were attached.
- `payment_created`: a payment link was created successfully by the provider mock.
- `pending`: payment exists and is waiting on final outcome.
- `paid`: payment completed successfully.
- `failed`: payment attempt failed.
- `cancelled`: payment was cancelled by office or payer flow.
- `expired`: payment link or payment window expired.

Final payment statuses:

- `paid`
- `failed`
- `cancelled`
- `expired`

### Invoice statuses

- `pending`: invoice attempt was opened but not completed yet.
- `created`: mock receipt was created successfully.
- `failed`: invoice attempt failed and can be retried later.
- `cancelled`: invoice attempt was cancelled.

### Webhook processing statuses

- `received`
- `processed`
- `failed`

## Authentication flow in phase 6

1. Open `/login`.
2. Enter the admin password from the environment configuration.
3. The app sets a signed `HttpOnly` admin session cookie.
4. Protected admin pages and internal admin APIs become accessible.
5. `POST /logout` clears the session.

Protected paths:

- `/`
- `/admin/*`
- `/api/payments`
- `/api/payments/:id`
- `/api/payments/:id/invoice/mock`
- development-only mock endpoints when dev tools are enabled

Public paths:

- `/login`
- `/logout`
- `/health`
- `/ready`
- `/api/grow/webhook`

## Mock webhook and invoice flow

1. Create a payment from `/admin/payments/new`.
2. Open the payment details page or the mock payment URL.
3. Trigger one of the development simulator buttons.
4. The UI sends a JSON payload to `POST /api/mock-grow/webhook`.
5. The backend:
   - stores the raw payload in `payment_webhooks`
   - finds the matching payment by provider identifiers
   - validates amount, currency, and allowed status transition
   - updates the payment if valid
   - if the new payment status is `paid`, attempts invoice creation through the invoice service
   - marks the webhook as `processed` or `failed`
6. If the same `event_id` is sent again, the webhook is treated as a duplicate and is not processed twice.
7. If invoice creation fails, the payment still stays `paid` and the invoice row is marked `failed`.

## Database schema overview

### `customers`

- canonical customer record for internal linking
- stores `name`, `phone`, `email`, and optional `external_crm_customer_id`

### `payments`

- stores denormalized customer snapshot fields for auditability
- stores only `amount_agorot` as integer money
- stores provider IDs and payment URL
- stores lifecycle timestamps such as `paid_at`, `cancelled_at`, `failed_at`

### `payment_webhooks`

- stores raw webhook payload text
- stores provider event IDs and transaction IDs when known
- tracks processing lifecycle separately from payment lifecycle

### `invoices`

- stores one invoice orchestration row per payment
- stores raw provider payload text
- stores invoice failure reason when the provider attempt fails
- uses a unique payment constraint so duplicate invoices are blocked at the database layer too

## Environment variables

Required or relevant keys:

- `APP_ENV=development|staging|production`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `DEFAULT_PAYMENT_PROVIDER=mock-grow`
- `GROW_MODE=mock|real`
- `INVOICE_MODE=mock|grow|external`
- `ENABLE_DEV_TOOLS=true|false`

Phase 6 constraints:

- `GROW_MODE` must stay `mock`
- `INVOICE_MODE` must stay `mock`
- development defaults for `ADMIN_PASSWORD` and `SESSION_SECRET` are allowed only in `APP_ENV=development`
- `ENABLE_DEV_TOOLS=true` is blocked in `production`

See [.env.example](/home/matan/Documents/accountant_nimrodi/.env.example) for the local scaffold values.

## Installation

```bash
npm install
npm run cf-typegen
```

Local development login defaults:

- password: `dev-admin-password`
- session secret fallback: `dev-session-secret-change-me`

Use those only for local development. Do not use them in staging or production.

## Local development

Start the Worker locally:

```bash
npm run dev -- --port 8787
```

Then open:

```text
http://127.0.0.1:8787
```

## Admin URLs

- Login: `http://127.0.0.1:8787/login`
- Dashboard: `http://127.0.0.1:8787/`
- New payment: `http://127.0.0.1:8787/admin/payments/new`
- Payments list: `http://127.0.0.1:8787/admin/payments`
- Payment details: `http://127.0.0.1:8787/admin/payments/<PAYMENT_ID>`
- Mock payment page: `http://127.0.0.1:8787/dev/mock-grow/pay/<PROVIDER_PAYMENT_ID>`
- Mock invoice page: `http://127.0.0.1:8787/dev/mock-invoices/<PROVIDER_INVOICE_ID>`
- Client requirements: `http://127.0.0.1:8787/admin/settings/client-requirements`

## Local migration commands

Generate Worker binding types:

```bash
npm run cf-typegen
```

Apply migrations to local D1:

```bash
npm run db:migrate:local
```

Apply migrations to remote D1 later:

```bash
npx wrangler d1 migrations apply nimrodi_payments --remote
```

## Internal API examples

Create a mocked payment request:

```bash
curl -X POST http://127.0.0.1:8787/api/payments \
  -H "content-type: application/json" \
  -d '{
    "customer_name": "לקוח בדיקה",
    "customer_phone": "0500000000",
    "customer_email": "test@example.com",
    "amount_shekel": "1250.00",
    "description": "שכר טרחה"
  }'
```

List payments with basic pagination:

```bash
curl "http://127.0.0.1:8787/api/payments?limit=20&offset=0"
```

Get one payment:

```bash
curl http://127.0.0.1:8787/api/payments/<PAYMENT_ID>
```

Simulate a paid webhook in development:

```bash
curl -X POST http://127.0.0.1:8787/api/mock-grow/webhook \
  -H "content-type: application/json" \
  -d '{
    "event_id": "mock_evt_example_paid",
    "event_type": "payment.paid",
    "provider": "mock_grow",
    "provider_payment_id": "<PROVIDER_PAYMENT_ID>",
    "provider_transaction_id": "<PROVIDER_TRANSACTION_ID>",
    "status": "paid",
    "amount_agorot": 125000,
    "currency": "ILS",
    "occurred_at": "2026-07-09T10:00:00.000Z"
  }'
```

Retry mock invoice creation manually for a paid payment:

```bash
curl -X POST http://127.0.0.1:8787/api/payments/<PAYMENT_ID>/invoice/mock
```

Reserved real webhook endpoint:

```bash
curl -X POST http://127.0.0.1:8787/api/grow/webhook \
  -H "content-type: application/json" \
  -d '{}'
```

## Health and readiness

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Readiness check:

```bash
curl http://127.0.0.1:8787/ready
```

Difference:

- `/health` confirms the Worker is up and reports safe high-level metadata.
- `/ready` additionally checks configuration validity and whether the D1 binding is available and queryable.

## Example local manual test flow

1. Run `npm run db:migrate:local`.
2. Run `npm run dev -- --port 8787`.
3. Open `/login` and sign in with the local development password.
4. Open `/admin/payments/new`.
5. Fill customer name, phone, email, amount in shekels, and description.
6. Submit the form.
7. Confirm the browser moves to the payment details page.
8. Confirm the details page shows:
   - status
   - amount
   - customer details
   - mock payment URL
   - provider payment id
   - copy link button
   - WhatsApp link button
9. Click `סימולציה: שולם`.
10. Confirm the status changes to `שולם`.
11. Confirm exactly one mock invoice is created automatically.
12. Confirm the payment details page shows the invoice section and mock invoice link.
13. Open the mock invoice page and confirm it is clearly labeled `מסמך מדומה — לצורכי פיתוח בלבד`.
14. POST the same `event_id` again to `/api/mock-grow/webhook` and confirm the response is duplicate-safe and no second invoice is created.
15. Create another payment and simulate `failed`, `cancelled`, and `expired`.
16. Confirm no invoice is created for those statuses.
17. Set `ENABLE_DEV_TOOLS=false` and confirm simulator buttons and dev routes are blocked.

## Dev tools flag

- When `ENABLE_DEV_TOOLS=true`:
  - `/api/mock-grow/webhook` works after admin login
  - `/dev/mock-grow/pay/:providerPaymentId` is accessible after admin login
  - `/dev/mock-invoices/:invoiceId` is accessible after admin login
  - simulator buttons are visible in the admin UI
- When `ENABLE_DEV_TOOLS=false`:
  - development-only endpoints return safe `404`
  - simulator buttons are hidden from the admin UI

## Lint, format, typecheck, tests

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
```

## Cloudflare deployment steps

1. Create a D1 database:

```bash
npx wrangler d1 create nimrodi_payments
```

2. Copy the returned database IDs into [wrangler.jsonc](/home/matan/Documents/accountant_nimrodi/wrangler.jsonc):
   - `database_id`
   - `preview_database_id`

3. Set required Cloudflare secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Future secrets, once real integrations exist:

```bash
npx wrangler secret put GROW_API_KEY
npx wrangler secret put GROW_API_SECRET
npx wrangler secret put INVOICE_PROVIDER_API_KEY
```

4. Apply remote migrations:

```bash
npx wrangler d1 migrations apply nimrodi_payments --remote
```

5. Deploy manually:

```bash
npx wrangler deploy
```

Client-owned infrastructure before real deployment:

- Cloudflare account
- domain or subdomain decision
- D1 database
- Cloudflare secrets

Notes:

- Runtime persistence uses the D1 binding from `wrangler.jsonc`.
- This repo still uses placeholder D1 IDs in `wrangler.jsonc` so the project can be scaffolded without client credentials.
- Replace the placeholder `database_id` and `preview_database_id` before real deployment.

## CI/CD notes

- `CI` runs on push and pull request:
  - `npm ci`
  - `npm run cf-typegen`
  - `npm run format:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
- `Deploy Placeholder` exists as a manual workflow and only runs when these GitHub secrets exist:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

## What is intentionally mocked

- Payment-provider request creation
- Payment-provider webhook payload schema
- Payment-provider hosted payment page
- Invoice-provider creation
- Invoice-provider hosted document page
- WhatsApp sending itself
- CRM integration

The local mock webhook schema is a development simulator only. It is **not** a verified GROW schema and must not be treated as production truth.

## What remains blocked by client details

- Client-owned Cloudflare account
- Technical/admin access for the developer
- D1 database ownership under the client account
- Domain or subdomain decision
- Client-owned GROW account
- GROW `userId`
- GROW `pageCode`
- GROW API credentials if required
- GROW sandbox and production details
- Confirmation that bank transfer is enabled in GROW
- Confirmation that API access is enabled in GROW
- Confirmation that webhooks are enabled in GROW
- Confirmation whether the GROW page can be bank-transfer-only
- Confirmation whether GROW issues receipts for bank-transfer payments
- Invoice-provider decision and API details if receipts are not issued by GROW
- CRM decision and API details if CRM integration will be added

## Verified commands

```bash
npm install
npm run format
npm run lint
npm run typecheck
npm run test
npm run cf-typegen
npm run db:migrate:local
npm run dev -- --port 8787
```

## Local verification completed in this phase

- `GET /health`
- unauthenticated `/` redirects to `/login`
- login works with the local dev password
- loading `/` after login
- loading `/admin/payments/new` after login
- creating a payment through the UI/API
- loading `/admin/payments`
- loading `/admin/payments/:id`
- mock webhook simulator works when `ENABLE_DEV_TOOLS=true`
- dev/mock pages are blocked or hidden when `ENABLE_DEV_TOOLS=false`
- `/api/grow/webhook` remains public and returns explicit not-implemented response
- logout works

## Compatibility note

- `compatibility_date` is pinned to `2025-07-18` because the verified local toolchain in this workspace is `Node 18.19.1` with `wrangler 3.114.17`.
- When the project moves to `Node 22+` and `wrangler 4`, update the compatibility date to the current day before production rollout.
