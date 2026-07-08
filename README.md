# מערכת תשלומים פנימית — נמרודי ושות׳

Phase 2 of an internal payment-request system for "נמרודי ושות׳ – רואי חשבון".

The long-term business flow is:

1. Internal admin user creates a payment request for a customer.
2. The system creates a provider payment request and returns a payment link.
3. The office manually sends the link to the customer.
4. Webhooks later update the payment status.
5. Receipt / invoice logic is added in a later phase.

This phase still does **not** connect to real GROW. It implements the real database/domain persistence layer on Cloudflare D1 while keeping the provider mocked.

## Current phase status

- Cloudflare Workers + Hono foundation is active.
- D1-backed repositories now power runtime persistence for customers, payments, and webhook records.
- The domain layer now includes payment statuses, invoice statuses, webhook processing statuses, and currency validation.
- The mock payment provider still creates deterministic fake payment links.
- Internal API read endpoints exist for inspecting payments.
- Admin shell still loads in Hebrew RTL and reads from the repository layer.
- No authentication yet.
- No real GROW integration yet.
- No production webhook processing flow yet.
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

## Internal API examples

Create a mocked payment request:

```bash
curl -X POST http://127.0.0.1:8787/api/payments \
  -H "content-type: application/json" \
  -d '{
    "customerName": "לקוח בדיקה",
    "customerPhone": "0500000000",
    "customerEmail": "test@example.com",
    "amountAgorot": 125000,
    "currency": "ILS",
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

Health check:

```bash
curl http://127.0.0.1:8787/health
```

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

- Runtime persistence now uses the D1 binding from `wrangler.jsonc`.
- This repo still uses placeholder D1 IDs in `wrangler.jsonc` so the project can be scaffolded without client credentials.
- Replace the placeholder `database_id` and `preview_database_id` before real deployment.
- Local D1 testing in this phase is verified through:
  - `npm run db:migrate:local`
  - `npm run dev -- --port 8787`
  - `GET /health`
  - loading the admin shell
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

Important:

- The mock provider is intentionally deterministic for testing.
- The mock provider does **not** claim to represent verified GROW production payloads.
- Real request / response shapes must be confirmed later against the client's real GROW account.

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
```
