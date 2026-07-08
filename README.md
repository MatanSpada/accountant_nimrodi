# מערכת תשלומים פנימית — נמרודי ושות׳

Phase 4 of an internal payment-request system for "נמרודי ושות׳ – רואי חשבון".

The long-term business flow is:

1. Internal admin user creates a payment request for a customer.
2. The system creates a provider payment request and returns a payment link.
3. The office manually sends the link to the customer.
4. Webhooks later update the payment status.
5. Receipt / invoice logic is added in a later phase.

This phase still does **not** connect to real GROW. It adds a mock webhook processing flow on top of the existing internal admin flow and the D1-backed persistence layer.

## Current phase status

- Cloudflare Workers + Hono foundation is active.
- D1-backed repositories persist customers, payments, and webhook records.
- Internal admin UI now supports:
  - dashboard
  - new payment form
  - payments list
  - payment details page
  - client requirements page
- A user can create a mock payment link from the admin UI, copy it, and open a manual WhatsApp link.
- A user can simulate `paid`, `failed`, `cancelled`, and `expired` webhook outcomes from the admin UI or the mock payment page.
- Payment list and payment details pages read from the repository layer.
- Incoming mock webhook payloads are stored raw in `payment_webhooks`, validated against the payment, and processed idempotently by `event_id`.
- No authentication yet.
- No real GROW integration yet.
- `/api/grow/webhook` is intentionally reserved and returns `501 Not Implemented` until verified real GROW payloads are available.
- No real invoice provider integration yet.

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
- `pending`: a payment exists and is waiting on final outcome.
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

- `draft`
- `issued`
- `failed`
- `cancelled`

### Webhook processing statuses

- `received`
- `processed`
- `failed`

## Mock webhook flow in phase 4

1. Create a payment from `/admin/payments/new`
2. Open the payment details page or the mock payment URL
3. Trigger one of the development simulator buttons
4. The UI sends a JSON payload to `POST /api/mock-grow/webhook`
5. The backend:
   - stores the raw payload in `payment_webhooks`
   - finds the matching payment by provider identifiers
   - validates amount, currency, and allowed status transition
   - updates the payment if valid
   - marks the webhook as `processed` or `failed`
6. If the same `event_id` is sent again, the webhook is treated as a duplicate and is not processed twice

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

- stores invoice linkage and raw provider payload text
- currently schema-only in this phase

## Installation

```bash
npm install
npm run cf-typegen
```

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

- Dashboard: `http://127.0.0.1:8787/`
- New payment: `http://127.0.0.1:8787/admin/payments/new`
- Payments list: `http://127.0.0.1:8787/admin/payments`
- Payment details: `http://127.0.0.1:8787/admin/payments/<PAYMENT_ID>`
- Mock payment page: `http://127.0.0.1:8787/dev/mock-grow/pay/<PROVIDER_PAYMENT_ID>`
- Client requirements: `http://127.0.0.1:8787/admin/settings/client-requirements`

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

Reserved real webhook endpoint:

```bash
curl -X POST http://127.0.0.1:8787/api/grow/webhook \
  -H "content-type: application/json" \
  -d '{}'
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Example local manual test flow

1. Run `npm run db:migrate:local`
2. Run `npm run dev -- --port 8787`
3. Open `/admin/payments/new`
4. Fill customer name, phone, email, amount in shekels, and description
5. Submit the form
6. Confirm the browser moves to the payment details page
7. Confirm the details page shows:
   - status
   - amount
   - customer details
   - mock payment URL
   - provider payment id
   - copy link button
   - WhatsApp link button
8. Click `סימולציה: שולם`
9. Confirm the status changes to `שולם`
10. Confirm a webhook record appears in the payment details page
11. POST the same `event_id` again to `/api/mock-grow/webhook` and confirm the response is duplicate-safe
12. Open `/admin/payments`
13. Confirm the created payment appears in the list with the updated status

## Tests

Run:

```bash
npm run test
```

## Lint, format, typecheck

Run:

```bash
npm run format
npm run lint
npm run typecheck
```

## D1 migrations

Generate Worker binding types:

```bash
npm run cf-typegen
```

Apply migrations to local D1:

```bash
npm run db:migrate:local
```

Notes:

- Runtime persistence uses the D1 binding from `wrangler.jsonc`.
- This repo still uses placeholder D1 IDs in `wrangler.jsonc` so the project can be scaffolded without client credentials.
- Replace the placeholder `database_id` and `preview_database_id` before real deployment.
- Local D1 testing in this phase is verified through:
  - `npm run db:migrate:local`
  - `npm run dev -- --port 8787`

## What is intentionally mocked

- Payment-provider request creation
- Payment-provider webhook payload schema
- Payment-provider hosted payment page
- WhatsApp sending itself
- Invoice creation
- CRM integration

The local mock webhook schema is a development simulator only. It is **not** a verified GROW schema and must not be treated as production truth.

## Why `/api/grow/webhook` is not active yet

- Real GROW sandbox or production payload examples have not been provided by the client.
- The parser must be implemented only after verifying the real fields, signature behavior, and status semantics from the client-owned GROW account.

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

- `GET /health`
- loading `/`
- loading `/admin/payments/new`
- creating a payment through the UI/API
- loading `/admin/payments`
- loading `/admin/payments/:id`
- `compatibility_date` is pinned to `2025-07-18` because the verified local toolchain in this workspace is `Node 18.19.1` with `wrangler 3.114.17`.
- When the project moves to `Node 22+` and `wrangler 4`, update the compatibility date to the current day before production rollout.

## Deployment later to Cloudflare

When the client provides the Cloudflare account and credentials:

1. Create a real D1 database.
2. Replace the placeholder `database_id` and `preview_database_id` in `wrangler.jsonc`.
3. Add real secrets with `wrangler secret put`.
4. Run migrations against the target environment.
5. Deploy with `wrangler deploy`.

For now, the included deploy script is a dry run:

```bash
npm run deploy
```

## What is intentionally mocked

- GROW payment creation
- GROW payment status checks
- Invoice / receipt provider
- CRM provider
- Payment URLs, payment IDs, and provider transaction IDs
- WhatsApp sending itself

Important:

- The mock provider is intentionally deterministic for testing.
- The mock provider does **not** claim to represent verified GROW production payloads.
- WhatsApp is only a manual helper link in this phase. No WhatsApp Business API is used.
- Real request / response shapes must be confirmed later against the client's real GROW account.

## What is still missing from the client

- Client-owned Cloudflare account
- Technical/admin access for the developer
- Client-owned GROW account
- GROW userId
- GROW pageCode
- GROW API credentials if required
- Sandbox details
- Production details
- Confirmation that bank transfer is enabled in GROW
- Confirmation that API access is enabled in GROW
- Confirmation that webhooks are enabled in GROW
- Confirmation whether the payment page can be bank-transfer-only
- Confirmation whether GROW issues receipts for bank-transfer payments
- CRM access/API details if integrating with existing CRM
- Invoice provider API details if receipts are issued outside GROW
- Domain/subdomain decision, for example `payments.nimrodi.co.il` or temporary Cloudflare URL

## Verified commands in this phase

```bash
npm install
npm run cf-typegen
npm run format
npm run lint
npm run typecheck
npm run test
npm run db:migrate:local
npm run dev -- --port 8787
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/
curl http://127.0.0.1:8787/admin/payments/new
curl http://127.0.0.1:8787/admin/payments
```
