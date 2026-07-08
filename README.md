# מערכת תשלומים פנימית — נמרודי ושות׳

Phase 1 foundation for an internal payment-request system for "נמרודי ושות׳ – רואי חשבון".

The long-term business flow is:

1. Internal admin user creates a payment request for a customer.
2. The system creates a provider payment request and returns a payment link.
3. The office manually sends the link to the customer.
4. Webhooks later update the payment status.
5. Receipt / invoice logic is added in a later phase.

This phase intentionally does **not** connect to real GROW. It builds the project foundation only.

## Current phase status

- Cloudflare Workers + Hono foundation created.
- D1 binding and migrations scaffolded.
- Provider interfaces defined for payments, invoices, and CRM.
- Mock payment and invoice providers implemented for local development.
- Minimal Hebrew RTL admin shell created.
- Initial tests and CI workflow added.
- No authentication yet.
- No real GROW integration yet.
- No real webhook handling yet.

## Tech stack

- TypeScript
- Cloudflare Workers
- Hono
- Cloudflare D1
- Wrangler
- Vitest
- ESLint
- Prettier

## Installation

```bash
npm install
npm run cf-typegen
```

## Local development

Start the Worker locally:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:8787
```

## API examples

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

List payments:

```bash
curl http://127.0.0.1:8787/api/payments
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

Local migration apply:

```bash
npm run db:migrate:local
```

Notes:

- This phase ships a placeholder D1 database ID in `wrangler.jsonc` so the project can be scaffolded without client credentials.
- Replace the placeholder with a real D1 database ID before real deployment.
- `compatibility_date` is currently pinned to `2025-07-18` because the verified local toolchain in this workspace is `Node 18.19.1` with `wrangler 3.114.17`.
- When the project is moved to `Node 22+` and `wrangler 4`, update the compatibility date to the current day before production rollout.

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

The following commands are expected to be verified in this phase after install:

```bash
npm install
npm run cf-typegen
npm run format
npm run lint
npm run typecheck
npm run test
```
