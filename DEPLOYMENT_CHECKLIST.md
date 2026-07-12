# Deployment Checklist

## Client-owned infrastructure

- Client Cloudflare account exists
- Developer has technical/admin access
- D1 database created in the client account
- Domain/subdomain decided, for example `payments.nimrodi.co.il`
- DNS configured through Cloudflare or target domain connected
- Cloudflare secrets configured by/for the client

## Required secrets/config

- `APP_ENV`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `ENABLE_DEV_TOOLS`
- `DEFAULT_PAYMENT_PROVIDER`
- `GROW_MODE`
- `PUBLIC_BASE_URL`
- `MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL` when `DEFAULT_PAYMENT_PROVIDER=make-grow`
- `MAKE_CREATE_PAYMENT_LINK_SECRET` if configured
- `MAKE_APPROVE_TRANSACTION_WEBHOOK_URL` if configured
- `MAKE_APPROVE_TRANSACTION_SECRET` if configured
- `GROW_USER_ID`, only for sandbox/production direct API
- `GROW_PAGE_CODE`, only for sandbox/production direct API
- `GROW_API_BASE_URL`, only for sandbox/production direct API
- `GROW_SUCCESS_URL`, `GROW_CANCEL_URL`, `GROW_NOTIFY_URL`, `GROW_INVOICE_NOTIFY_URL` only for the direct API path
- invoice provider credentials later if an external invoice provider is used

## GROW requirements before real payment

- client-owned GROW account
- Make account/scenario configured if using `make-grow`
- API access enabled only if using the direct API path
- bank transfer enabled
- webhook enabled
- sandbox credentials/details if using the direct API path
- production credentials/details if using the direct API path
- verified webhook payload examples from the real Make + GROW flow
- confirmation whether bank-transfer-only payment page is supported
- invoice decision: GROW documents or external invoice provider

## Deployment steps

1. Install dependencies
2. Run tests
3. Create D1 database
4. Apply remote migrations
5. Set secrets
6. Deploy Worker
7. Test `/health`
8. Test `/ready`
9. Log in
10. Create a mock payment in staging if dev tools are enabled
11. Disable dev tools for production
12. Verify `/api/grow/webhook` is reachable

## GitHub Actions deployment flow

- CI runs on every `pull_request`.
- CI also runs on every push to `master`.
- Automatic staging deployment runs only on push to `master`.
- The staging deploy job depends on CI passing first.
- No staging deployment runs from pull requests.
- No staging deployment runs if `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` is missing.

GitHub Actions secrets required for staging deploy:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Cloudflare Worker secrets remain stored in Cloudflare itself:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

To inspect deployment status:

1. Open the repository in GitHub.
2. Open `Actions`.
3. Open the latest `CI` workflow run.
4. Review `verify`.
5. Review `Deploy staging`.

## Manual command reference

Install:

```bash
npm install
```

Test and validate:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run cf-typegen
```

Create D1:

```bash
npx wrangler d1 create accountant-nimrodi
```

Apply remote migrations:

```bash
npx wrangler d1 migrations apply accountant-nimrodi --remote --env staging
```

Note:

- The current repository version of Wrangler does not expose `--yes` for `d1 migrations apply`.
- GitHub Actions uses the same staging migration command that already works manually.

Set admin secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD --env staging
npx wrangler secret put SESSION_SECRET --env staging
```

Deploy:

```bash
npx wrangler deploy --env staging
```

Rotate the staging admin password later:

```bash
npx wrangler secret put ADMIN_PASSWORD --env staging
```

## Go-live checks

- mock mode disabled only when real sandbox/production is ready
- dev tools disabled in production
- admin password changed from development default
- `SESSION_SECRET` strong and rotated from default
- no test data in production DB unless explicitly approved
- backup/export process understood by the client
