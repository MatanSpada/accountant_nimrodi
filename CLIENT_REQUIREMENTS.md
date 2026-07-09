# Client Requirements Still Missing Before Real Integration

- Client-owned Cloudflare account
- Technical/admin access for the developer
- Client-owned domain/subdomain decision, for example `payments.nimrodi.co.il`
- Client-owned D1 database under the client Cloudflare account

## GROW account and payment-link requirements

- Client-owned GROW account
- GROW `userId`
- GROW `pageCode`
- Verified sandbox endpoint/details
- Verified production endpoint/details
- API credentials if the verified GROW account/docs require them
- Confirmation that API access is enabled in GROW
- Confirmation that bank transfer is enabled in GROW
- Confirmation whether the payment page can be bank-transfer-only
- Confirmation whether bank-transfer-only is supported by the real GROW API/page configuration
- Confirmation that webhooks are enabled in GROW
- Verified sandbox webhook payload examples
- Verified production webhook payload examples if different from sandbox
- Confirmation whether GROW issues receipts/invoices for bank-transfer payments

## Invoice/receipt decision

- Client decision: receipts/invoices will be issued either by GROW or by an existing invoice provider

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

## CRM decision

- CRM access/API details if we integrate with an existing CRM
- Clarification whether CRM payment status updates are required in the first production rollout

Document type must be confirmed by the client/accountant. This repo does not decide accounting or legal document behavior on its own.
