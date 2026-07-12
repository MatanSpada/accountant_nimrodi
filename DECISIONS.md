# Technical Decisions

## Why Cloudflare Workers was selected

- It is free-tier-friendly for an MVP.
- It matches the requirement to host first on Cloudflare.
- It is sufficient for an internal admin system plus webhook ingestion in early phases.
- It keeps hosting, runtime, and edge entrypoint simple for a single-service start.

## Compatibility date decision

- Cloudflare currently recommends setting `compatibility_date` to the current day on new projects.
- In this workspace, the verified local runtime is `Node 18.19.1`, which forced use of `wrangler 3.114.17` instead of `wrangler 4.x`.
- That toolchain only supports local runtime compatibility through `2025-07-18`, so the config is pinned to `2025-07-18` for a clean working baseline.
- Once the development environment moves to `Node 22+` and `wrangler 4`, the compatibility date should be advanced to the then-current date before real production rollout.

## Why D1 was selected for MVP

- D1 is the lowest-friction relational option inside the same Cloudflare stack.
- It avoids introducing paid external infrastructure in early phases.
- It fits the current scope: modest internal transaction volume, simple relational tables, and low operational overhead.

## What it means to keep the database replaceable

- Domain services depend on repository interfaces, not on D1 directly.
- Route handlers do not execute SQL directly.
- SQL concerns stay inside `infrastructure/db`.
- The D1 repository maps SQL rows into domain objects so the rest of the app does not depend on D1 column names.
- A future PostgreSQL or other repository implementation should be able to replace the D1 adapters without rewriting payment business logic.

## Why raw payloads are stored as text

- Real webhook and invoice payload formats are not yet verified against the client systems.
- Storing the raw payload as JSON text preserves the original input for debugging, replay, and auditing.
- Text storage is portable across SQLite/D1 and future relational databases.
- Tradeoff:
  - JSON text is less queryable than a normalized payload schema
  - later phases can project selected verified fields into structured columns when needed

## Why `amount_agorot` is used

- Integer agorot avoids floating-point rounding bugs in money handling.
- It makes validation and comparisons predictable across providers and databases.
- Tradeoff:
  - UI and reports must always format integer values explicitly back to human-readable currency

## Payment/customer denormalization decision

- Payments store both `customer_id` and snapshot fields such as `customer_name`, `customer_phone`, and `customer_email`.
- Meaning:
  - the app can link to a reusable customer record
  - each payment still keeps the exact customer details used at creation time
- Tradeoff:
  - data exists in two places
  - updates to customer records do not retroactively rewrite historical payment snapshots

## Schema indexing decision

- Indexes were added for:
  - `payments.status`
  - `payments.created_at`
  - `payments.provider_transaction_id`
  - CRM linkage columns
  - customer identity columns
  - webhook lookup columns
- Meaning:
  - the common internal admin lookups and webhook correlation flows stay simple and reasonably efficient
- Tradeoff:
  - each index slightly increases write cost
  - for MVP this is acceptable because reads and support/debug flows matter more than micro-optimizing writes

## Unique provider transaction decision

- `payments(provider, provider_transaction_id)` is unique when `provider_transaction_id` is not null.
- Meaning:
  - the system protects itself from accidentally associating the same provider transaction with multiple internal payments
- Tradeoff:
  - if a provider behaves unexpectedly, support staff may need a manual remediation path later

## Customer resolution decision

- When creating a payment, the service attempts to reuse an existing customer by exact normalized email first, then exact normalized phone.
- If no match exists, a new customer is created.
- Meaning:
  - internal linkage begins now without needing CRM integration yet
- Tradeoff:
  - this is intentionally conservative and may miss fuzzy matches
  - later CRM-aware flows can improve identity resolution

## Runtime repository decision for phase 2

- Runtime now uses D1-backed repositories when `env.DB` exists, and in-memory repositories only when no D1 binding is available.
- Meaning:
  - local `wrangler dev` and Cloudflare environments exercise real persistence paths
  - unit tests can stay fast and deterministic without requiring a database boot
- Tradeoff:
  - D1 repository behavior is verified mainly through local migrations/dev runtime plus in-memory unit tests, not a full database integration suite yet

## Admin UI approach

- The admin UI stays server-rendered with Hono HTML responses and minimal vanilla JavaScript.
- Meaning:
  - the app stays lightweight
  - the UI can be hosted from the same Worker without adding a separate frontend build pipeline
  - the code stays close to the backend flow while the product is still internal and small
- Tradeoff:
  - interactions are simpler than a full SPA
  - more advanced future UI behavior may require progressive enhancement or a dedicated frontend layer

## Manual WhatsApp helper decision

- WhatsApp is implemented as a manual helper link using `https://wa.me/...`.
- Meaning:
  - the office user can click a generated link and manually send the prepared message
  - no Meta approval, webhook setup, or WhatsApp Business API integration is required in this phase
- Tradeoff:
  - sending is not automated
  - there is no delivery tracking or outgoing message audit from within the system

## Why no WhatsApp API yet

- The business goal in this phase is only to help the office send the payment link manually.
- The WhatsApp API would add approval, compliance, and operational complexity too early.
- Tradeoff:
  - manual operator action is still required for every customer send

## Why GROW remains mocked

- Real GROW request/response behavior is still unverified against the client's real account.
- Keeping GROW mocked preserves architectural progress without fabricating production assumptions.
- Meaning:
  - the admin flow, persistence flow, and manual send flow can be finished now
  - only the provider adapter needs to change later
- Tradeoff:
  - no real money movement is tested yet
  - no real provider failure modes are covered yet

## Frontend approach decision

- I kept server-rendered HTML from the Worker instead of introducing a heavy frontend framework.
- Reason:
  - the project focus is still on domain and persistence architecture
  - the internal admin shell does not need SPA complexity yet
  - this keeps deployment, testing, and maintenance simpler
- Tradeoff:
  - richer workflows will later need progressive enhancement or a dedicated frontend layer

## Folder structure decision

- I preserved the phase 1 and phase 2 separation between route, middleware, domain, infrastructure, shared, and UI layers.
- I kept D1-specific logic in `infrastructure/db`.
- I kept provider-specific mock behavior inside the provider layer.
- I added UI-specific helpers such as status labels and WhatsApp links under `src/ui/admin` so they do not leak into domain or repository code.

## Mock webhook schema decision

- I added a mock webhook schema only for local development at `POST /api/mock-grow/webhook`.
- Meaning:
  - the team can prove the critical backend path now: payment created -> webhook stored -> status updated -> duplicate event ignored safely
  - the parser stays clearly isolated from the rest of the payment business logic
- Tradeoff:
  - this schema is intentionally not reusable as a real GROW parser
  - the real parser must be written later from verified client payloads

## Why real GROW webhook is intentionally not implemented yet

- The project still lacks verified sandbox or production webhook payloads from the client's GROW account.
- Implementing a "best guess" parser now would create false confidence and brittle assumptions.
- Meaning:
  - `/api/grow/webhook` is reserved but returns `501 Not Implemented`
  - the rest of the system can still be tested end-to-end through the mock simulator
- Tradeoff:
  - no real provider signature or webhook retry behavior is covered yet

## Webhook idempotency approach

- Webhook records are deduplicated by `(provider, provider_event_id)`.
- The processor checks for an existing event before creating a new record or applying side effects.
- Meaning:
  - sending the same `event_id` twice is safe
  - later invoice-generation logic can rely on the same protection boundary
- Tradeoff:
  - this phase treats duplicate `event_id` as a no-op instead of a replayable retry path

## Duplicate webhook behavior decision

- Duplicate event IDs return a successful duplicate-safe response instead of an error.
- Meaning:
  - provider retries or manual repeated simulator calls do not break the flow
  - operators can safely test duplicate delivery behavior
- Tradeoff:
  - duplicate attempts are not stored as separate rows in this MVP
  - if detailed delivery-attempt auditing is needed later, a separate attempts table can be added

## Why admin simulation triggers a webhook instead of direct status update

- The admin simulator buttons call `POST /api/mock-grow/webhook` rather than updating the payment directly.
- Meaning:
  - the application exercises the real backend control flow that matters later in production
  - validation, raw payload storage, idempotency, and status-transition logic are tested together
- Tradeoff:
  - the simulator adds a little client-side JavaScript instead of a simpler direct update form

## Mock payment page decision

- I changed the mock payment URL to a local Worker route under `/dev/mock-grow/pay/:providerPaymentId`.
- Meaning:
  - the fake payment link is now usable during local development
  - the office flow and the customer-side simulation can both be tested without leaving the app
- Tradeoff:
  - the stored URL is intentionally local-development-oriented and not shareable as a real external payment link

## Why invoice creation is provider-based

- Invoice creation now goes through an `InvoiceProvider` interface instead of being hardcoded inside the webhook service.
- Meaning:
  - the system can later swap between GROW-issued documents and an external provider without rewriting payment business rules
  - provider-specific payloads remain isolated in `infrastructure/invoices`
- Tradeoff:
  - there is one more abstraction layer to maintain

## Why invoice creation is triggered from the paid webhook flow

- The business event that matters is a payment becoming `paid`, not a user opening the payment page.
- Meaning:
  - invoice creation follows the same source-of-truth event that production will rely on later
  - duplicate paid webhook handling can also protect against duplicate invoices
- Tradeoff:
  - invoice creation now depends on the webhook-processing orchestration path instead of a simpler UI-only action

## Duplicate invoice prevention strategy

- The invoice service checks for an existing invoice by `payment_id` before creating a new one.
- The database also enforces uniqueness on `invoices.payment_id`.
- Meaning:
  - duplicate webhooks and repeated manual retry attempts cannot create a second receipt for the same payment
- Tradeoff:
  - retries reuse the same invoice row instead of storing many invoice attempts as separate records

## Why payment remains paid if invoice creation fails

- Payment state and invoice state are intentionally separated.
- Meaning:
  - the system does not falsely "unpay" a successful payment just because downstream document generation failed
  - support staff can retry invoice generation later without corrupting payment history
- Tradeoff:
  - the UI must show that payment and invoice can temporarily diverge

## Invoice schema decision

- I added a follow-up migration instead of rewriting the original invoice table definition.
- The migration adds:
  - `failure_reason`
  - a unique index on `payment_id`
  - a unique provider invoice index
- Meaning:
  - local environments that already applied phase 4 migrations can evolve forward cleanly
- Tradeoff:
  - the schema now spans multiple migration files even though the project is still early

## Admin authentication approach

- I used a simple password-based login with a signed session cookie.
- Meaning:
  - the internal admin UI and internal payment APIs are protected without introducing an external identity provider in this MVP
  - the authentication boundary stays inside the Worker and can be replaced later
- Tradeoff:
  - this is weaker and less auditable than a full SSO or Cloudflare Access setup
  - password rotation and user-level attribution are still manual

## Why not Cloudflare Access yet

- Cloudflare Access is a strong future option, but it was not added in this phase because the current requirement was a self-contained MVP-safe internal tool without requiring client account setup during development.
- Meaning:
  - the app can run locally and in early staging with only Worker secrets
  - the auth code remains modular so Cloudflare Access can replace or supplement it later
- Tradeoff:
  - identity control is application-managed for now instead of Cloudflare-managed

## Dev-tools gating strategy

- Development-only endpoints and simulator UI are gated by `ENABLE_DEV_TOOLS`.
- Meaning:
  - `/api/mock-grow/webhook` and `/dev/*` can be used safely in development
  - the same codebase can be deployed to staging or production without exposing mock tools
- Tradeoff:
  - there is one more environment control to validate and document
  - operators must be disciplined about environment configuration

## Config validation strategy

- Runtime configuration is parsed centrally from a single config module.
- Meaning:
  - route handlers and services consume validated values instead of reading raw environment variables ad hoc
  - invalid production configuration fails early and predictably
- Tradeoff:
  - startup is stricter, so incomplete deployment configuration causes immediate failure instead of partial functionality

## Production safety rules for config

- `GROW_MODE` and `INVOICE_MODE` are still restricted to `mock`.
- `ENABLE_DEV_TOOLS=true` is rejected in `production`.
- development defaults for `ADMIN_PASSWORD` and `SESSION_SECRET` are allowed only in `APP_ENV=development`.
- Meaning:
  - the repo cannot quietly drift into pretending that real integrations exist
  - accidental production exposure of simulators is blocked by config and tests
- Tradeoff:
  - staging and production setup now require explicit secret management before the app can be considered ready

## Health versus readiness decision

- `/health` remains lightweight and safe, while `/ready` additionally checks validated config and D1 availability.
- Meaning:
  - uptime checks can stay simple
  - deployment or orchestration checks can use readiness without exposing secrets
- Tradeoff:
  - there are now two operational endpoints to document and monitor

## CI/CD approach and tradeoffs

- CI now verifies format, lint, typecheck, generated Worker types, and tests on push/pull request.
- A separate deploy workflow exists only as a manual placeholder and runs only when Cloudflare secrets exist.
- Meaning:
  - the repo gains deployment preparation without forcing secret-dependent failures in normal CI
  - production deployment remains an intentional step
- Tradeoff:
  - deployment automation is not fully active yet
  - the final production rollout still depends on client-owned Cloudflare credentials and environment setup

## Why the real Grow provider is behind config

- The codebase now supports both `MockPaymentProvider` and `GrowPaymentProvider`, but the real provider is selected only through validated runtime config.
- Meaning:
  - the same architecture supports local development, sandbox trials, and later production rollout
  - route handlers and domain services remain provider-agnostic
- Tradeoff:
  - startup configuration is stricter and more verbose

## Why mock remains the default

- The client has not yet provided all verified GROW account details, endpoints, and webhook payload examples.
- Meaning:
  - the app remains runnable and fully testable without any external credentials
  - development can continue without pretending that a real provider is ready
- Tradeoff:
  - the default developer experience is intentionally conservative rather than "real by default"

## Grow request mapping assumptions

- The request mapping for `createPaymentProcess` is isolated in `src/infrastructure/grow/grow-request-mapper.ts`.
- Meaning:
  - all unverified field-name assumptions live in one place and are easy to review or replace once the client sandbox is available
  - route handlers and services do not need to know Grow-specific request details
- Tradeoff:
  - the current mapper is only a best-effort bridge until verified against a real GROW sandbox account

## Why real Grow webhook parsing is still not implemented

- No verified sandbox or production webhook payload examples exist locally yet.
- Meaning:
  - `/api/grow/webhook` stays public but returns `501 Not Implemented`
  - the already working mock webhook flow continues to prove the business-critical backend path safely
- Tradeoff:
  - real provider status updates still cannot be processed end-to-end

## Bank-transfer-only verification decision

- The config now includes `GROW_FORCE_BANK_TRANSFER_ONLY`, but no Grow request field is sent for it yet.
- Meaning:
  - the product can track the office requirement and surface it in settings
  - the app avoids fabricating an unverified payment-method field in real API calls
- Tradeoff:
  - bank-transfer-only remains a blocked requirement until verified with GROW/client account details

## Production mock-mode guard

- `APP_ENV=production` with `GROW_MODE=mock` is blocked unless `ALLOW_MOCK_GROW_IN_PRODUCTION=true`.
- Meaning:
  - the system does not silently stay in fake payment mode during a production deployment
  - temporary controlled production-like deployments can still be unblocked intentionally
- Tradeoff:
  - one more config flag must be understood and documented by operators

## Why the mock invoice page is not a legal document

- The mock invoice page exists only to verify orchestration and stored data during development.
- Meaning:
  - the office can confirm that invoice creation happened and inspect the generated values
  - nobody should confuse the page with a valid accounting receipt
- Tradeoff:
  - the mock page intentionally looks functional but must still be clearly labeled as development-only

## Operational CSV export decision

- I added a simple authenticated CSV export at `/admin/payments/export.csv` instead of a larger reporting subsystem.
- Meaning:
  - the office can export operational payment data immediately for review, backup, or manual reconciliation
  - the feature stays inside the existing admin/auth boundary with no new infrastructure
- Tradeoff:
  - the export is intentionally basic and synchronous
  - larger reporting or filtered exports may need pagination or background jobs later

## Safe HTML and JSON error response decision

- I kept separate safe error behaviors for admin pages and APIs.
- Meaning:
  - admin pages return Hebrew HTML error states that fit the internal UI
  - API routes return JSON without stack traces or secret-bearing config details
  - the same approach now covers 404, config failures, and unexpected errors
- Tradeoff:
  - there is a little more response-handling code in the app shell
  - future logging/observability integration should preserve the same no-secrets boundary

## Why Make is now the recommended GROW integration path

- GROW quoted a recurring monthly cost for direct API usage, while Make can use the official GROW app for the MVP path.
- Meaning:
  - the app sends payment creation requests to a Make webhook instead of calling GROW directly
  - Make becomes the integration bridge for both `Create Payment Link` and `Approve Transaction`
  - the existing mock flow stays untouched for safe local and staging work
- Tradeoff:
  - there is now an extra dependency on Make scenario configuration
  - exact incoming webhook payload fields still need confirmation from a real Make + GROW flow

## Provider selection decision after Make

- `DEFAULT_PAYMENT_PROVIDER` is now the primary selector for payment creation.
- Supported values are:
  - `mock-grow`
  - `make-grow`
  - `grow`
- Meaning:
  - payment-provider choice is explicit and does not rely only on `GROW_MODE`
  - the older direct-GROW adapter remains available in code without being the recommended path
- Tradeoff:
  - runtime config is slightly more explicit
  - docs and status pages must explain both `DEFAULT_PAYMENT_PROVIDER` and `GROW_MODE`

## Why incomplete Make config does not crash the whole admin UI

- When `DEFAULT_PAYMENT_PROVIDER=make-grow` but the required webhook URL is missing, the UI still loads and shows a clear status message.
- Meaning:
  - operators can open the admin and see what is missing
  - payment creation is blocked safely before any real provider request is attempted
- Tradeoff:
  - provider readiness is enforced at payment-creation time instead of hard-failing the entire app startup

## Why Make/GROW webhook parsing is defensive

- The project does not yet have a fully verified production webhook contract from the real Make + GROW flow.
- Meaning:
  - the parser accepts several candidate field names for identifiers and status fields
  - unknown statuses are stored without changing the payment state
  - amount and currency are validated only when they are present in the payload
- Tradeoff:
  - some payload assumptions remain TODO items until sandbox data is captured
  - stricter signature or schema validation must be added later

## Why Approve Transaction happens after persistence

- GROW can repeat notifications until `Approve Transaction` is performed.
- Meaning:
  - the app first stores the raw event and updates the payment safely
  - only after persistence succeeds does it call the Make approve webhook
  - approval failure is logged and attached as a processing note without rolling back the paid payment
- Tradeoff:
  - a temporary mismatch can exist where the payment is paid but the upstream approval still failed and needs operational follow-up

## Why mock invoices are blocked for make-grow payments

- A paid `make-grow` payment is a real-payment path, even if invoice automation is still missing.
- Meaning:
  - the UI no longer implies that a real receipt was issued
  - mock invoice creation remains available only for `mock-grow` demo payments
- Tradeoff:
  - paid Make/GROW payments may show "document not configured yet" until the invoice decision is finalized
