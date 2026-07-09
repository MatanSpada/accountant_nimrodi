# Client Requirements Checklist

## Must have before deployment

- Client-owned Cloudflare account
- Technical/admin access for the developer
- Client-owned D1 database in the client Cloudflare account
- Domain/subdomain decision, for example `payments.nimrodi.co.il`
- DNS/domain connection configured through Cloudflare or target domain setup
- Admin secrets chosen by the client:
  - `ADMIN_PASSWORD`
  - `SESSION_SECRET`
- Production decision for `ENABLE_DEV_TOOLS=false`

## Must have before real GROW sandbox

- Client-owned GROW account
- GROW `userId`
- GROW `pageCode`
- Verified sandbox endpoint/details
- API credentials if the verified sandbox account/docs require them
- Confirmation that API access is enabled in GROW
- Confirmation that bank transfer is enabled in GROW
- Confirmation whether the payment page can be bank-transfer-only
- Confirmation whether bank-transfer-only is supported by the real GROW API/page configuration
- Confirmation that webhooks are enabled in GROW
- Verified sandbox webhook payload examples

## Must have before production payments

- Verified production endpoint/details
- Production credentials if required by the verified account/docs
- Verified production webhook payload examples if different from sandbox
- Confirmation whether GROW issues receipts/invoices for bank-transfer payments
- Final choice for `GROW_MODE=production`
- Final public URLs for:
  - `GROW_SUCCESS_URL`
  - `GROW_CANCEL_URL`
  - `GROW_NOTIFY_URL`
  - `GROW_INVOICE_NOTIFY_URL` if needed

## Must have before real invoice integration

- Client decision: documents will be issued either by GROW or by an existing invoice provider

If an existing invoice provider is used, the client must provide:

- provider name
- API documentation
- API credentials
- sandbox details if available
- required document type, as instructed by the client/accountant:
  - קבלה
  - חשבונית מס/קבלה
  - חשבונית עסקה
  - other
- required VAT/tax behavior, as instructed by the client/accountant

## Optional CRM integration details

- CRM access/API details if integrating with an existing CRM
- Clarification whether CRM payment status updates are required in the first production rollout
- Clarification whether CRM customer lookup should be authoritative or optional

Document type must be confirmed by the client/accountant. This repo does not decide accounting or legal document behavior on its own.
