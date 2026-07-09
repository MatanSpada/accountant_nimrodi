# מערכת תשלומים פנימית — נמרודי ושות׳

Phase 8/8. This repository is the final MVP handoff state for an internal payment-link system for "נמרודי ושות׳ – רואי חשבון".

## MVP overview

The system currently supports:

1. Internal admin login with a signed cookie session.
2. Manual creation of payment requests from an internal Hebrew RTL admin UI.
3. Persistent storage in Cloudflare D1 for customers, payments, webhooks, and invoice attempts.
4. Mock payment-link creation for safe local/staging work.
5. Mock webhook simulation for `paid`, `failed`, `cancelled`, and `expired`.
6. Automatic creation of exactly one mock invoice after a paid webhook.
7. Safe duplicate webhook handling.
8. CSV export of payments for internal review.
9. A configurable real `GrowPaymentProvider` behind validated config, while leaving mock mode as the default.

## Final MVP state

- Hosting target: Cloudflare Workers
- Database target: Cloudflare D1
- Default payment mode: `GROW_MODE=mock`
- Default invoice mode: `INVOICE_MODE=mock`
- Real GROW webhook parsing: not implemented yet
- Real invoice provider: not implemented yet
- CRM integration: not implemented yet

## Quick start

```bash
npm install
npm run cf-typegen
npm run db:migrate:local
npm run dev -- --port 8787
```

Open:

```text
http://127.0.0.1:8787/login
```

Local development defaults:

- `ADMIN_PASSWORD=dev-admin-password`
- `SESSION_SECRET=dev-session-secret-change-me`

Use them only in local development.

## Auth

- `/login` opens the internal admin login page.
- `/logout` clears the admin session.
- `/`, `/admin/*`, `/api/payments*`, and `/admin/payments/export.csv` require admin auth.
- `/api/grow/webhook` remains public because future provider webhooks must reach it without admin login.

## Local development

Mock mode requires no GROW credentials:

```env
APP_ENV=development
GROW_MODE=mock
INVOICE_MODE=mock
ENABLE_DEV_TOOLS=true
```

Useful URLs:

- `/`
- `/admin/payments/new`
- `/admin/payments`
- `/admin/payments/export.csv`
- `/admin/settings/client-requirements`

## Mock flow

1. Log in to the admin UI.
2. Create a payment from `/admin/payments/new`.
3. Copy the link or use the WhatsApp helper.
4. Open the payment details page.
5. Trigger mock webhook simulation when dev tools are enabled.
6. Confirm that:
   - payment status updates
   - webhook record is stored
   - a paid payment creates exactly one mock invoice

## Grow modes

### `GROW_MODE=mock`

- default mode
- no real GROW credentials required
- uses `MockPaymentProvider`

### `GROW_MODE=sandbox`

- uses `GrowPaymentProvider`
- requires validated sandbox config
- still does not enable real webhook parsing

### `GROW_MODE=production`

- uses `GrowPaymentProvider`
- requires validated production config
- `mock` in `APP_ENV=production` is blocked unless `ALLOW_MOCK_GROW_IN_PRODUCTION=true`

## Required configuration

Core runtime keys:

- `APP_ENV`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `ENABLE_DEV_TOOLS`
- `GROW_MODE`
- `INVOICE_MODE`

Required only for `GROW_MODE=sandbox|production`:

- `GROW_USER_ID`
- `GROW_PAGE_CODE`
- `GROW_API_BASE_URL`
- `GROW_SUCCESS_URL`
- `GROW_CANCEL_URL`
- `GROW_NOTIFY_URL`
- `GROW_INVOICE_NOTIFY_URL` if needed
- `GROW_API_KEY` only if the verified account/docs require it

Optional tracked flag:

- `GROW_FORCE_BANK_TRANSFER_ONLY`

Important:

- The app does not send any unverified bank-transfer-only field to GROW yet.
- Real GROW webhook parsing is still blocked until verified payload examples exist locally.

## Health and readiness

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/ready
```

- `/health` reports safe high-level runtime status.
- `/ready` verifies config validity and DB availability.
- In sandbox/production misconfiguration, both return safe error information without secrets.

## CSV export

Protected admin export:

```text
/admin/payments/export.csv
```

Current CSV fields:

- `created_at`
- `customer_name`
- `customer_phone`
- `customer_email`
- `amount`
- `currency`
- `status`
- `invoice_status`
- `provider`
- `provider_payment_id`
- `provider_transaction_id`
- `invoice_number`
- `invoice_url`

## Deployment summary

Before real deployment:

1. Use a client-owned Cloudflare account.
2. Create the client-owned D1 database.
3. Apply migrations remotely.
4. Set real admin secrets.
5. Keep `ENABLE_DEV_TOOLS=false` in production.
6. Keep `GROW_MODE=mock` until real sandbox/production details are confirmed.

Current temporary staging deployment on the developer Cloudflare account uses:

```bash
npx wrangler d1 migrations apply accountant-nimrodi --remote --env staging
npx wrangler secret put ADMIN_PASSWORD --env staging
npx wrangler secret put SESSION_SECRET --env staging
npx wrangler deploy --env staging
```

## CI/CD

GitHub Actions currently runs one workflow for both verification and staging deployment:

- On every `pull_request`: run verification only.
- On every push to `master`: run verification, then deploy staging only if verification passed.

Verification steps in CI:

- `npm ci` when `package-lock.json` exists, otherwise `npm install`
- `npm run cf-typegen`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

Automatic staging deployment runs only on push to `master` and uses:

```bash
npx wrangler d1 migrations apply accountant-nimrodi --remote --env staging
npx wrangler deploy --env staging
```

Note:

- The current project uses `wrangler@3.114.17`.
- `wrangler d1 migrations apply` in this version does not expose a `--yes` flag.
- The workflow therefore uses the exact non-interactive staging command that is already working manually.

Required GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Cloudflare Worker secrets stay in Cloudflare and are not stored in GitHub Actions:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

To rotate the admin password later:

```bash
npx wrangler secret put ADMIN_PASSWORD --env staging
```

To review deployment status:

1. Open the GitHub repository.
2. Open the `Actions` tab.
3. Open the latest `CI` run.
4. Check the `verify` job and then the `Deploy staging` job.

See [DEPLOYMENT_CHECKLIST.md](/home/matan/Documents/accountant_nimrodi/DEPLOYMENT_CHECKLIST.md) for the full checklist.

## Operations and data ownership

- D1 data belongs to the client and should live in a client-owned Cloudflare account.
- Manual admin operations are documented in [OPERATIONS.md](/home/matan/Documents/accountant_nimrodi/OPERATIONS.md).
- Security expectations are documented in [SECURITY.md](/home/matan/Documents/accountant_nimrodi/SECURITY.md).

Manual D1 export example for later client operations:

```bash
npx wrangler d1 export accountant-nimrodi --remote --env staging --output=./accountant-nimrodi-export.sql
```

Rotate admin secrets later with:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

## Smoke/config validation

Safe placeholder:

```bash
npm run grow:smoke -- --confirm
```

Current behavior:

- runs only when `GROW_MODE=sandbox`
- validates required sandbox config keys
- does not send a network request yet

## What is still not implemented

- Real GROW webhook parsing
- Real GROW webhook verification/signature logic
- Real invoice provider integration
- Real CRM integration
- User-level multi-account auth/roles
- Production branding assets from the client

## What is still mocked

- Mock payment pages
- Mock webhook payload schema
- Mock invoice generation
- Mock invoice pages
- WhatsApp sending itself

## Next steps after receiving client details

1. Add the client-owned Cloudflare account access.
2. Create the real D1 database in that account.
3. Set production admin secrets.
4. Add verified GROW sandbox config.
5. Validate the `GrowPaymentProvider` request/response mapping against the real sandbox account.
6. Implement real GROW webhook parsing only after verified payloads are available.
7. Decide whether invoices come from GROW or from an external provider.

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
