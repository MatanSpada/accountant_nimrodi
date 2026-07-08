# Client Requirements Still Missing Before Real Integration

- Client-owned Cloudflare account
- Technical/admin access for the developer
- Client-owned GROW account
- GROW userId
- GROW pageCode
- GROW API credentials if required
- Sandbox details
- Production details
- Confirmation that bank transfer is enabled
- Confirmation that API access is enabled
- Confirmation that webhooks are enabled
- Confirmation whether payment page can be bank-transfer-only
- Confirmation whether GROW issues receipts for bank-transfer payments
- Client decision: receipts/invoices will be issued either by GROW or by an existing invoice provider
- Real GROW webhook payload examples from sandbox and/or production
- CRM access/API details if we integrate with an existing CRM
- If an existing invoice provider is used:
  - provider name
  - API documentation
  - API credentials
  - sandbox details if available
  - required document type, as instructed by the client/accountant:
    - קבלה
    - חשבונית מס/קבלה
    - חשבונית עסקה
    - other
  - required VAT / tax behavior, as instructed by the client/accountant
- Domain/subdomain decision, for example `payments.nimrodi.co.il` or a temporary Cloudflare URL

Document type must be confirmed by the client/accountant. This repo does not decide accounting or legal document behavior on its own.
