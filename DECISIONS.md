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
- It avoids introducing paid external infrastructure in phase 1.
- It fits the current scope: modest internal transaction volume, simple relational tables, and low operational overhead.

## What it means to keep the database replaceable

- Domain services depend on repository interfaces, not on D1 directly.
- Route handlers do not execute SQL directly.
- SQL concerns are intended to stay inside infrastructure adapters.
- A future PostgreSQL or other repository implementation should be able to replace the D1 adapter without rewriting payment business logic.

## What it means to keep GROW replaceable

- Payment creation and payment status checks depend on `PaymentProvider`.
- The system does not expose GROW-specific assumptions outside the provider boundary.
- Mock behavior is explicit and isolated.
- A future `GrowPaymentProvider` can be added without rewriting routes or payment orchestration code.

## Tradeoffs of Cloudflare Workers vs a standard Node server

- Pros:
  - simple deployment model
  - low idle cost
  - easy fit for HTTP APIs and webhook endpoints
  - direct path to Cloudflare-native bindings like D1
- Cons:
  - less runtime flexibility than a traditional long-running Node server
  - some Node packages behave differently or require `nodejs_compat`
  - debugging background and persistence patterns is different from a standard server
  - local parity depends on Wrangler and Cloudflare runtime tooling

## Frontend approach decision

- I used server-rendered HTML from the Worker instead of a heavy frontend framework.
- Reason:
  - the phase goal is architectural foundation, not client-side application complexity
  - an internal admin shell does not need SPA overhead yet
  - this keeps deployment, testing, and maintenance simpler
- Tradeoff:
  - interactive flows will eventually need either progressive enhancement or a dedicated frontend layer
  - for now, the shell is intentionally restrained and static-first

## Folder structure decision

- I kept route, middleware, domain, infrastructure, shared, and UI layers separate.
- I grouped business interfaces under domain modules and mocks under infrastructure modules.
- I included `infrastructure/db` now even though the runtime repository is in-memory, because phase 1 must prepare for D1-backed persistence next.
- I did not mirror every requested folder one-to-one where it would create empty noise. For example:
  - `domain/customers` currently contains the CRM provider interface
  - `domain/invoices` currently contains the invoice provider interface
  - `infrastructure/grow`, `infrastructure/invoices`, and `infrastructure/crm` contain current mocks

## Runtime repository decision for phase 1

- The running app currently uses an in-memory repository.
- Reason:
  - it allows the system to run immediately without real Cloudflare provisioning
  - it avoids pretending that placeholder D1 credentials are production-ready
  - it keeps the domain and provider boundaries testable today
- Tradeoff:
  - data is not durable yet
  - the D1 migration files are planning artifacts until a real D1-backed repository is added
