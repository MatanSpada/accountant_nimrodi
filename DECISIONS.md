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
