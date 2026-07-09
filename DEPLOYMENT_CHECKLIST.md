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
- `GROW_MODE`
- `GROW_USER_ID`, only for sandbox/production
- `GROW_PAGE_CODE`, only for sandbox/production
- `GROW_API_BASE_URL`, only for sandbox/production
- `GROW_SUCCESS_URL`
- `GROW_CANCEL_URL`
- `GROW_NOTIFY_URL`
- `GROW_INVOICE_NOTIFY_URL` if needed
- invoice provider credentials later if an external invoice provider is used

## GROW requirements before real payment

- client-owned GROW account
- API access enabled
- bank transfer enabled
- webhook enabled
- sandbox credentials/details
- production credentials/details
- verified webhook payload examples
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

Set admin secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD --env staging
npx wrangler secret put SESSION_SECRET --env staging
```

Deploy:

```bash
npx wrangler deploy --env staging
```

## Go-live checks

- mock mode disabled only when real sandbox/production is ready
- dev tools disabled in production
- admin password changed from development default
- `SESSION_SECRET` strong and rotated from default
- no test data in production DB unless explicitly approved
- backup/export process understood by the client
