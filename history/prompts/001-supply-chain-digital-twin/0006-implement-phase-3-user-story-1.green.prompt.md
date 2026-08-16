---
id: 0006
title: Implement Phase 3 User Story 1
stage: green
date: 2026-08-15
surface: agent
model: claude-sonnet-5
feature: 001-supply-chain-digital-twin
branch: 001-supply-chain-digital-twin
user: my5757980@gmail.com
command: /sp.implement
labels: ["implement", "user-story-1", "mvp", "twin", "ingestion", "csv", "sse", "frontend"]
links:
  spec: specs/001-supply-chain-digital-twin/spec.md
  ticket: https://challenges.ignyte.ae/competition/00B42B34-228F-F111-B337-6045BD14DEDF
  adr: null
  pr: null
files:
 - apps/api/prisma/schema.prisma
 - apps/api/prisma/migrations/20260815063603_user_story_1_twin/migration.sql
 - apps/api/src/identity/dto/create-tenant.dto.ts
 - apps/api/src/identity/tenant.mapper.ts
 - apps/api/src/identity/tenant.service.ts
 - apps/api/src/identity/tenant.controller.ts
 - apps/api/src/identity/tenant-context.util.ts
 - apps/api/src/identity/identity.module.ts
 - apps/api/src/ingestion/dto/create-inventory-item.dto.ts
 - apps/api/src/ingestion/dto/create-supplier.dto.ts
 - apps/api/src/ingestion/dto/csv-upload.dto.ts
 - apps/api/src/ingestion/ingestion.mapper.ts
 - apps/api/src/ingestion/inventory.controller.ts
 - apps/api/src/ingestion/supplier.controller.ts
 - apps/api/src/ingestion/csv-upload.controller.ts
 - apps/api/src/ingestion/csv-ingestion.queue.ts
 - apps/api/src/ingestion/freshness-checker.service.ts
 - apps/api/src/ingestion/ingestion.module.ts
 - apps/api/src/twin/twin.service.ts
 - apps/api/src/twin/twin.controller.ts
 - apps/api/src/twin/twin.module.ts
 - apps/api/src/notification/twin-events.service.ts
 - apps/api/src/notification/notification.module.ts
 - apps/api/src/app.module.ts
 - apps/api/package.json
 - specs/001-supply-chain-digital-twin/contracts/api.yaml
 - apps/web/lib/api.ts
 - apps/web/components/ui/input.tsx
 - apps/web/components/ui/card.tsx
 - apps/web/app/onboarding/page.tsx
 - apps/web/app/twin/page.tsx
 - specs/001-supply-chain-digital-twin/tasks.md
tests:
 - apps/api/test/contract/tenants.spec.ts (Jest, 2 passed)
 - apps/api/test/contract/data-sources.spec.ts (Jest, 2 passed)
 - apps/api/test/contract/inventory-items.spec.ts (Jest, 2 passed)
 - apps/api/test/contract/suppliers.spec.ts (Jest, 2 passed)
 - apps/api/test/contract/twin.spec.ts (Jest, 1 passed)
 - apps/api/test/integration/twin-view.spec.ts (Jest, 2 passed)
 - apps/api/test/integration/stale-data.spec.ts (Jest, 1 passed)
 - apps/api/test/integration/tenant-isolation.spec.ts (Jest, 2 passed)
 - manual curl end-to-end smoke test against running dev servers (onboard → login → add data → twin)
---

## Prompt

(Continuation of the /sp.implement session; user said "continue karoooo" to
proceed from Phase 2 into Phase 3 — User Story 1, the MVP: live digital
twin view.)

## Response snapshot

Extended the Prisma schema with Supplier, InventoryItem, Order, OrderLineItem, and LogisticsEvent (T024–T027), generated a new migration, and extended T009's RLS pattern to every new table — including a variant for `order_line_items`/`logistics_events`, which have no `tenant_id` of their own and are instead scoped via an `EXISTS` subquery against their parent `orders` row. Smoke-tested RLS on the new tables via `psql` as `app_runtime` before writing any application code, catching nothing new (the T009 pattern held).

Implemented the full ingestion → twin → notification pipeline: `TenantService`/`TenantController` for onboarding (`POST /tenants`, T028); a BullMQ-backed `CsvIngestionQueue` (T029, matching research.md §5's Redis job-queue decision) with a Worker that parses CSV via `csv-parse` and upserts inventory/suppliers/orders; manual-entry `InventoryController`/`SupplierController` (T030); a `TwinService` (T031) that computes a Redis-cached snapshot and explicitly invalidates + recomputes on every write rather than relying on TTL alone, wired to `GET /twin` (T032); a `FreshnessCheckerService` (T033, `@nestjs/schedule` cron) that flags stale `DataSource` rows; and a `TwinEventsService` (T034) publishing `twin.updated` over the existing SSE gateway. Built the onboarding wizard (T035) and live Digital Twin dashboard (T036) in `apps/web`, wired to a new `lib/api.ts` client and two new shadcn-style primitives (`Input`, `Card`).

Wrote and ran 12 new tests (8 contract + 3 integration, all passing) covering every stated acceptance criterion for T016–T023, then ran a real end-to-end smoke test with `curl` against the actually-running `apps/api` and `apps/web` dev servers (onboard → dev-login → add inventory/supplier → `GET /twin` reflects it), since no browser automation tool was available this session to visually verify the frontend — confirmed `next build` succeeds and both new pages serve `200` with expected content instead.

Found and fixed three real gaps during implementation, not just at review: (1) initially wrote a frontend `findOwnerId` stub that deliberately threw, because `POST /tenants`'s original contract response had no way for the client to bootstrap a session — fixed at the source by extending `TenantService.onboard` to also return the owner's user id, documented in `tenant.mapper.ts` and `contracts/api.yaml` as a dev-mode-only bootstrap field, not a permanent contract commitment; (2) the CSV upload controller returned the NestJS default `201` instead of the contract's `202` — caught before writing the corresponding contract test, not after; (3) `FreshnessCheckerService` updated `DataSource.status` directly via Prisma without invalidating the twin's Redis cache, meaning an already-cached snapshot could keep showing stale data as fresh for up to 30 seconds — fixed by having it call the same `refreshAndNotify` path every other twin-affecting write uses. Also hit and resolved two environment issues: a `prisma generate` file lock from orphaned `jest --runInBand` processes left over from an earlier session restart (killed the stray PIDs after confirming their command lines), and the same class of orphaned-process cleanup after the manual dev-server smoke test.

## Outcome

- ✅ Impact: User Story 1 (P1, the MVP) is complete, tested, and demoable — an SME owner can onboard, connect data via manual entry or CSV, and see a live, auto-updating digital twin.
- 🧪 Tests: 12 new Jest tests (8 contract, 3 integration — wait, 4 integration counting stale-data) all passing; full backend suite now 30 tests / 15 suites, all green; frontend verified via successful `next build` + route smoke test + a full manual curl walk of the real HTTP flow.
- 📁 Files: ~30 new/modified files across `apps/api` (schema, migration, 6 new modules' worth of controllers/services) and `apps/web` (API client, 2 UI primitives, 2 pages); `contracts/api.yaml` and `tasks.md` updated.
- 🔁 Next prompts: Awaiting user confirmation to proceed to Phase 4 (User Story 2 — early disruption warning, T037–T053), which is the first phase touching `apps/ai-service` and the Claude API.
- 🧠 Reflection: The `findOwnerId` stub-that-throws was a real near-miss — writing it and moving on would have shipped genuinely broken code; catching it required actually re-reading what I'd just written rather than assuming the happy path. Worth treating "I wrote a function that just throws" as an immediate stop-and-fix signal, not a TODO to revisit later.

## Evaluation notes (flywheel)

- Failure modes observed: (1) a self-authored dead-end stub function, caught before finalizing; (2) a contract status-code mismatch (202 vs default 201), caught before the test would have caught it anyway; (3) a cache-invalidation gap in the freshness checker, caught by reasoning through the write paths rather than by a failing test (no test exercised the "already cached, then goes stale" ordering).
- Graders run and results (PASS/FAIL): `tsc --noEmit` (api, web) — PASS; `eslint` (api, web) — PASS; `nest build` — PASS; `next build` — PASS; Jest — 30/30 PASS across 15 suites; manual curl E2E smoke test — PASS.
- Prompt variant (if applicable): N/A
- Next experiment (smallest change to try): Add an explicit test for the "twin already cached, then its underlying data source goes stale" ordering, since that's exactly the class of bug (fixed) that no existing test would have caught.
