# Operations Guide

## Daily admin flow

### Create a payment

1. Log in to the admin UI
2. Open `/admin/payments/new`
3. Fill customer name, phone/email if available, amount, and description
4. Submit the request
5. Copy the payment link or use the WhatsApp helper

### Send the link

- Use the copy-link button to copy the payment URL
- Use the WhatsApp helper to open a prefilled manual message
- Sending is still manual in this MVP

### Check payment status

- Open `/admin/payments`
- Review:
  - date
  - customer
  - phone/email
  - amount
  - payment status
  - invoice status
  - provider mode

### Review payment details

Open `/admin/payments/:id` to see:

- internal payment ID
- provider payment ID
- provider transaction ID
- payment URL
- invoice information
- webhook records
- timestamps

## Handling non-paid states

### Failed / cancelled / expired

- Review the payment details page
- Confirm the status and timestamp
- Recreate a new payment request if the office decides to try again

## Handling invoice issues

### Invoice failed

- Payment should remain `paid`
- Review the invoice section on the payment details page
- If allowed, use the manual mock retry action for development verification
- In real production later, replace this with the approved invoice-provider retry flow

### No invoice was created for a paid Make/GROW payment

- This is expected until the real invoice path is confirmed
- The payment can still be validly marked as `paid`
- Review whether the client chose:
  - GROW-issued documents
  - or an external invoice provider

## CSV export

Use:

```text
/admin/payments/export.csv
```

The CSV is protected by admin auth and is intended for internal office review/export.

## Troubleshooting webhook issues

- Open the payment details page
- Review the webhook records section
- Check:
  - event type
  - processing status
  - processing error
- In mock mode, duplicate webhook delivery is safe and should not create duplicate invoices

## Rotating admin secrets

Set new values in the deployment environment / Cloudflare secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

After rotation, verify:

- `/health`
- `/ready`
- login works with the new password

## Disabling dev tools

Set:

```env
ENABLE_DEV_TOOLS=false
```

Expected behavior:

- mock simulator buttons disappear
- `/api/mock-grow/webhook` is blocked
- `/dev/*` pages are blocked

## Switching from mock to sandbox later

1. Keep the current deployment
2. Add verified sandbox GROW settings
3. Prefer `DEFAULT_PAYMENT_PROVIDER=make-grow` for the current MVP path
4. Configure the Make `Create Payment Link` scenario and `PUBLIC_BASE_URL`
5. Keep invoice automation disabled until the real document flow is confirmed

## Switching from sandbox to production later

1. Verify sandbox behavior
2. If using Make, switch the Make scenario to production GROW credentials
3. If using the direct API path, replace sandbox endpoints/credentials with production values and set `GROW_MODE=production`
4. Keep `ENABLE_DEV_TOOLS=false`
5. Re-verify `/health`, `/ready`, login, payment creation, and webhook reachability
