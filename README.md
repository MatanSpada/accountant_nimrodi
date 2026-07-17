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
9. A configurable payment-provider layer with `mock-grow`, `make-grow`, and the legacy direct `grow` adapter kept behind config.

## Final MVP state

- Hosting target: Cloudflare Workers
- Database target: Cloudflare D1
- Default payment provider: `DEFAULT_PAYMENT_PROVIDER=mock-grow`
- Default invoice mode: `INVOICE_MODE=mock`
- Recommended real integration path: `make-grow` through Make.com
- Real GROW webhook parsing: implemented defensively for the Make path, but exact payload mapping still needs real sandbox confirmation
- Real invoice provider: not implemented yet
- CRM integration: not implemented yet

## Admin UI

The admin interface (`/admin/payments`) is a Hebrew RTL Power BI-style dashboard with:

- **Smart filter bar** — date range calendar picker (dd/mm/yy format), customer autocomplete (shows suggestions from first typed character), multi-select status dropdown.
- **Client-side filter interactions** — filter results update without a full page reload. The status dropdown stays open while selecting multiple statuses; results fetch in the background. Sort headers, chip removes, and pagination also use partial page updates via `fetch()` + `DOMParser`. Falls back to full navigation if fetch fails.
- **Active filter chips** — one chip per active filter with individual × removal. Date range shows as a single combined chip.
- **Sortable table columns** — click column headers to sort ascending/descending; sort state persists across filter changes via URL params.
- **Row numbers** — numbered consistently with pagination offset.
- **URL-driven state** — all filter and sort state is stored in query params, making filtered views bookmarkable and shareable.

## Quick start

For the fastest resume in a new session, start with [SESSION_HANDOFF.md](/home/matan/Documents/accountant_nimrodi/SESSION_HANDOFF.md).

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
DEFAULT_PAYMENT_PROVIDER=mock-grow
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

### `DEFAULT_PAYMENT_PROVIDER=mock-grow`

- default mode
- no real GROW or Make credentials required
- uses `MockPaymentProvider`

### `DEFAULT_PAYMENT_PROVIDER=make-grow`

- recommended MVP integration path
- the app sends payment data to a Make webhook
- Make uses the official GROW app action `Create Payment Link`
- the app expects Make to return the payment URL and provider identifiers
- paid notifications can trigger a second Make webhook for `Approve Transaction`
- real receipt creation is still not configured in this path

### `GROW_MODE=mock`

- keeps the legacy direct-GROW adapter disabled while mock mode is active

### `GROW_MODE=sandbox`

- used only when `DEFAULT_PAYMENT_PROVIDER=grow`
- requires validated sandbox config for the legacy direct-GROW adapter

### `GROW_MODE=production`

- used only when `DEFAULT_PAYMENT_PROVIDER=grow`
- requires validated production config for the legacy direct-GROW adapter
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

Required for `DEFAULT_PAYMENT_PROVIDER=make-grow`:

- `MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL`
- `PUBLIC_BASE_URL`
- `MAKE_CREATE_PAYMENT_LINK_SECRET` if a shared secret is configured in Make
- `MAKE_APPROVE_TRANSACTION_WEBHOOK_URL` if the Make scenario also handles `Approve Transaction`
- `MAKE_APPROVE_TRANSACTION_SECRET` if a shared secret is configured for the approve webhook

Optional tracked flag:

- `GROW_FORCE_BANK_TRANSFER_ONLY`

Important:

- The app does not send any unverified bank-transfer-only field to GROW yet.
- The app sends `allowed_payment_methods=["bank_transfer"]` to Make for clarity, but the exact field mapping inside Make still needs confirmation.

See [MAKE_GROW_INTEGRATION.md](/home/matan/Documents/accountant_nimrodi/MAKE_GROW_INTEGRATION.md).

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

- Exact GROW webhook payload confirmation from a real sandbox/production account
- Real GROW webhook verification/signature logic
- Real invoice provider integration
- Real CRM integration
- User-level multi-account auth/roles
- Production branding assets from the client

## What is still mocked

- Mock payment pages
- Mock webhook payload schema
- Mock invoice generation for `mock-grow` only
- Mock invoice pages for `mock-grow` only
- WhatsApp sending itself

## Next steps after receiving client details

1. Add the client-owned Cloudflare account access.
2. Create the real D1 database in that account.
3. Set production admin secrets.
4. Build the Make scenario for `Create Payment Link`.
5. Build the Make scenario for `Approve Transaction`.
6. Validate the incoming webhook payload from real GROW notifications through Make.
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
