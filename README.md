# מערכת תשלומים פנימית — נמרודי ושות׳

Phase 7/8 of an internal payment-request system for "נמרודי ושות׳ – רואי חשבון".

The long-term business flow is:

1. Internal admin user creates a payment request for a customer.
2. The system creates a provider payment request and returns a payment link.
3. The office manually sends the link to the customer.
4. Webhooks later update the payment status.
5. A receipt/invoice attempt is triggered after a paid webhook.

This phase adds a configurable real `GrowPaymentProvider` behind environment configuration, while keeping mock mode as the default and safe operating mode. Real GROW webhook parsing is still intentionally not implemented.

## Current phase status

- Cloudflare Workers + Hono foundation is active.
- D1-backed repositories persist customers, payments, webhook records, and invoice records.
- Internal admin UI supports:
  - dashboard
  - new payment form
  - payments list
  - payment details page
  - client requirements / provider status page
- Admin login at `/login` protects internal admin pages and internal payment APIs.
- The app supports `GROW_MODE=mock|sandbox|production`.
- `mock` remains the default mode and requires no GROW credentials.
- `sandbox` and `production` fail fast when required GROW config is missing.
- `POST /api/payments` still works end-to-end in mock mode.
- Mock webhook flow and mock invoice flow still work unchanged.
- `/api/grow/webhook` is still reserved and returns `501 Not Implemented` until verified webhook payload examples exist locally.

## Tech stack

- TypeScript
- Cloudflare Workers
- Hono
- Cloudflare D1
- Wrangler
- Vitest
- ESLint
- Prettier

## Grow modes

### `GROW_MODE=mock`

- default mode
- safe local development mode
- no GROW credentials required
- uses `MockPaymentProvider`

### `GROW_MODE=sandbox`

- uses `GrowPaymentProvider`
- requires validated sandbox config
- intended only after the client provides verified sandbox details

### `GROW_MODE=production`

- uses `GrowPaymentProvider`
- requires validated production config
- `GROW_MODE=mock` in `APP_ENV=production` is blocked unless `ALLOW_MOCK_GROW_IN_PRODUCTION=true`

## Authentication flow

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

## Environment variables

Required or relevant keys:

- `APP_ENV=development|staging|production`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `DEFAULT_PAYMENT_PROVIDER=mock-grow`
- `GROW_MODE=mock|sandbox|production`
- `ALLOW_MOCK_GROW_IN_PRODUCTION=true|false`
- `GROW_USER_ID`
- `GROW_PAGE_CODE`
- `GROW_API_BASE_URL`
- `GROW_SUCCESS_URL`
- `GROW_CANCEL_URL`
- `GROW_NOTIFY_URL`
- `GROW_INVOICE_NOTIFY_URL`
- `GROW_API_KEY`
- `GROW_FORCE_BANK_TRANSFER_ONLY=true|false`
- `INVOICE_MODE=mock|grow|external`
- `ENABLE_DEV_TOOLS=true|false`

Phase 7 constraints:

- `mock` remains the default GROW mode.
- `sandbox` and `production` require validated GROW settings.
- `INVOICE_MODE` still remains `mock`.
- development defaults for `ADMIN_PASSWORD` and `SESSION_SECRET` are allowed only in `APP_ENV=development`.
- `ENABLE_DEV_TOOLS=true` is blocked in `production`.
- `GROW_FORCE_BANK_TRANSFER_ONLY=true` is only tracked as a request flag right now. No unverified bank-transfer-only field is sent to GROW yet.

See [.env.example](/home/matan/Documents/accountant_nimrodi/.env.example) for safe placeholders.

## Installation

```bash
npm install
npm run cf-typegen
```

Local development login defaults:

- password: `dev-admin-password`
- session secret fallback: `dev-session-secret-change-me`

Use those only for local development. Do not use them in staging or production.

## How to stay in mock mode

Keep:

```env
GROW_MODE=mock
INVOICE_MODE=mock
```

That is enough to run the full internal admin flow locally without any GROW credentials.

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

## Mock flow in phase 7

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

## Preparing sandbox mode

Before switching to sandbox, the client must provide:

- `GROW_USER_ID`
- `GROW_PAGE_CODE`
- verified sandbox `GROW_API_BASE_URL`
- verified `GROW_SUCCESS_URL`
- verified `GROW_CANCEL_URL`
- verified `GROW_NOTIFY_URL`
- optional `GROW_INVOICE_NOTIFY_URL`
- `GROW_API_KEY` only if the verified client account/docs require it

Important:

- The request mapper in `src/infrastructure/grow/grow-request-mapper.ts` is still based on isolated assumptions that must be verified against the client sandbox account.
- Bank-transfer-only behavior is not sent to GROW yet because the required field is still unverified.
- Real webhook parsing is still blocked until verified payload examples are available.

## Smoke test / config validation

Safe placeholder command:

```bash
npm run grow:smoke -- --confirm
```

Current behavior:

- runs only when `GROW_MODE=sandbox`
- validates required sandbox config keys
- prints what is missing if config is incomplete
- does **not** send a real network request yet

This is intentionally conservative until verified sandbox credentials and endpoint behavior are available locally.

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

Future GROW-related secrets or env vars, once the client supplies verified details:

```bash
npx wrangler secret put GROW_API_KEY
```

Set non-secret runtime vars in `wrangler.jsonc` or environment-specific config:

- `GROW_MODE`
- `GROW_USER_ID`
- `GROW_PAGE_CODE`
- `GROW_API_BASE_URL`
- `GROW_SUCCESS_URL`
- `GROW_CANCEL_URL`
- `GROW_NOTIFY_URL`
- `GROW_INVOICE_NOTIFY_URL`
- `GROW_FORCE_BANK_TRANSFER_ONLY`

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
- verified GROW account details

## CI/CD notes

- `CI` runs on push and pull request:
  - `npm ci`
  - `npm run cf-typegen`
  - `npm run format:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
- `grow:smoke` does not run in CI.
- `Deploy Placeholder` exists as a manual workflow and only runs when these GitHub secrets exist:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

## What is intentionally mocked

- Payment-provider webhook payload schema
- Payment-provider hosted mock payment page
- Invoice-provider creation
- Invoice-provider hosted document page
- WhatsApp sending itself
- CRM integration

Mock mode remains the default. The local mock webhook schema is a development simulator only. It is **not** a verified GROW schema and must not be treated as production truth.

## What remains blocked by client details

- Client-owned Cloudflare account
- Technical/admin access for the developer
- D1 database ownership under the client account
- Domain or subdomain decision
- Client-owned GROW account
- GROW `userId`
- GROW `pageCode`
- verified sandbox endpoint/details
- verified production endpoint/details
- GROW API credentials if required by the real account
- Confirmation that bank transfer is enabled in GROW
- Confirmation that API access is enabled in GROW
- Confirmation that webhooks are enabled in GROW
- Confirmation whether the GROW page can be bank-transfer-only
- Confirmation whether GROW supports bank-transfer-only through the real API/page configuration
- Verified sandbox webhook payload examples
- Verified production webhook payload examples if different
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

- app starts in default mock mode without Grow credentials
- `GET /health`
- `GET /ready`
- unauthenticated `/` redirects to `/login`
- login works with the local dev password
- loading `/` after login
- loading `/admin/payments/new` after login
- creating a payment through the UI/API in mock mode
- mock webhook `paid` flow still creates exactly one mock invoice
- `ENABLE_DEV_TOOLS=false` still blocks `/api/mock-grow/webhook` and `/dev/*`
- settings page shows Grow mode and missing client requirements
- sandbox mode with missing config fails clearly
- `/api/grow/webhook` remains public and returns an explicit not-implemented message
- no GROW secrets are printed in config/provider error messages

## Compatibility note

- `compatibility_date` is pinned to `2025-07-18` because the verified local toolchain in this workspace is `Node 18.19.1` with `wrangler 3.114.17`.
- When the project moves to `Node 22+` and `wrangler 4`, update the compatibility date to the current day before production rollout.
