# Security Notes

## What is protected

- Admin UI pages under `/` and `/admin/*`
- Internal admin APIs under `/api/payments*`
- CSV export under `/admin/payments/export.csv`
- Development-only mock endpoints when they are enabled

Authentication in phase 6 uses a signed admin session cookie created after login at `/login`.

## What is not protected

- `/health`
- `/ready`
- `POST /api/grow/webhook`

`/api/grow/webhook` stays unauthenticated because real provider webhooks will need machine-to-machine access later. Real webhook signature / origin verification is still not implemented because real GROW payloads are not available yet.

## Secrets handling

- Do not commit real secrets to git.
- `ADMIN_PASSWORD` and `SESSION_SECRET` must be supplied through environment variables / Cloudflare secrets.
- GROW credentials must not be logged or exposed in readiness/UI responses.
- Development defaults exist only for `APP_ENV=development`.
- Production must not run with development secrets.

## Dev tools

- Mock webhook endpoints and mock document pages are development-only tools.
- They are controlled by `ENABLE_DEV_TOOLS`.
- They must be disabled in production.
- Production UI must not expose simulator buttons when dev tools are disabled.

## Data sensitivity

- D1 stores customer names, phones, emails, payment descriptions, provider identifiers, webhook payloads, and invoice payloads.
- Treat the database as sensitive internal business data.

## Backups and export

- Before production rollout, define who owns exports and backups for the D1 database.
- At minimum, the client should own the Cloudflare account and the D1 database.
- CSV export is intended for internal operational use and does not include secrets.
- D1 export/backup procedures should be agreed with the client before go-live.

## Future hardening

- Prefer Cloudflare Access or an equivalent identity layer if the client wants stronger access control than a shared admin password.
- Add real webhook verification once verified GROW payloads and webhook behavior are available.
