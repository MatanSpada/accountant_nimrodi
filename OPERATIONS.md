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
3. Set `GROW_MODE=sandbox`
4. Keep real webhook parsing disabled until verified payload examples exist
5. Validate payment creation against the sandbox account

## Switching from sandbox to production later

1. Verify sandbox behavior
2. Replace sandbox endpoints/credentials with production values
3. Set `GROW_MODE=production`
4. Keep `ENABLE_DEV_TOOLS=false`
5. Re-verify `/health`, `/ready`, login, payment creation, and webhook reachability
