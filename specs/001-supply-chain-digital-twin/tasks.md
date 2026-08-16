---
description: "Task list for Supply Chain Digital Twin implementation"
---

# Tasks: Supply Chain Digital Twin

**Input**: Design documents from `/specs/001-supply-chain-digital-twin/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md (all present)

**Tests**: Included — `plan.md`'s Technical Context specifies concrete test
frameworks (Jest/Supertest, Playwright/RTL, pytest) and `quickstart.md` §5
explicitly enumerates the required contract/integration/unit tests, so test
tasks are generated alongside implementation tasks per user story.

**Organization**: Tasks are grouped by user story (from `spec.md`: US1 =
P1 live twin view, US2 = P2 early disruption alert, US3 = P3 act on
contingency plan) so each can be implemented, tested, and demoed
independently, per Constitution Principle VII (Pilot-Ready by Design).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an
  incomplete task)
- **[Story]**: Maps the task to US1 / US2 / US3
- Every task names its exact file path (per `plan.md`'s Project Structure)

## Path Conventions

Monorepo per `plan.md`:
- `apps/web/` — Next.js frontend
- `apps/api/` — NestJS platform service (identity, ingestion, twin, action, notification, audit)
- `apps/ai-service/` — FastAPI AI service (prediction, sourcing recommendation, contingency plan agents)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the three-app monorepo so every later task has
somewhere to land.

- [X] T001 Create monorepo root structure (`apps/web/`, `apps/api/`, `apps/ai-service/`, root `package.json` workspaces) per `plan.md` Project Structure
  - **Acceptance**: Running a workspace-aware install command from repo root resolves all three app directories as workspaces; no app-specific code yet. ✅ Verified: `npm install` from repo root installs both `apps/web` and `apps/api` as workspaces.
- [X] T002 [P] Initialize `apps/web` with Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui
  - **Acceptance**: `npm run dev` in `apps/web` serves a default page at `localhost:3000` with Tailwind styles applied and at least one shadcn/ui component rendering. ✅ Verified: `next build` compiles successfully; `Button` (shadcn-style) renders on `/`.
- [X] T003 [P] Initialize `apps/api` with NestJS 10+, TypeScript strict mode, Prisma (or TypeORM) configured against `DATABASE_URL`
  - **Acceptance**: `npm run start:dev` in `apps/api` boots on `:4000` and responds `200` on a health-check route; `tsconfig.json` has `strict: true`. ✅ Verified: `tsc --noEmit` clean, `GET /health` implemented and covered by a passing Jest test, Prisma schema wired to `DATABASE_URL`.
- [X] T004 [P] Initialize `apps/ai-service` with FastAPI, Python 3.11+, Anthropic SDK, Pydantic, type hints enforced
  - **Acceptance**: `uvicorn main:app --reload --port 4100` boots and `GET /health` returns `200`; `mypy`/`pyright` runs clean on an empty scaffold. ✅ Verified: `pytest` 1/1 passed, `mypy app` clean, `ruff check` clean.
- [X] T005 [P] Configure linting/formatting: ESLint + Prettier for `apps/web`/`apps/api`, ruff + black for `apps/ai-service`
  - **Acceptance**: A lint command exists and passes in each of the three apps; CI-runnable without manual steps. ✅ Verified: `eslint` clean in `apps/web` and `apps/api`; `ruff check` clean in `apps/ai-service`.
- [X] T006 [P] Add `docker-compose.yml` for local PostgreSQL 15 + Redis 7
  - **Acceptance**: `docker compose up` starts both services reachable at the ports referenced in each app's `.env.example`. ⚠️ `docker compose config` validates the file successfully; actually starting the containers requires Docker Desktop's engine running locally (not running in this environment) — verify with `docker compose up -d` once Docker Desktop is started.
- [X] T007 [P] Add `.env.example` for each app (`apps/web`, `apps/api`, `apps/ai-service`) per `quickstart.md` §1
  - **Acceptance**: Every environment variable named in `quickstart.md` §1 appears in the corresponding `.env.example` with a placeholder value. ✅ Verified: all three `.env.example` files created matching quickstart.md §1.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

- [X] T008 Define `Tenant`, `User`, `DataSource` schema + migration in `apps/api/prisma/schema.prisma` (or TypeORM entities) per `data-model.md`, including `Tenant.ai_processing_consent_at`
  - **Acceptance**: Migration runs clean against a fresh database; `Tenant.onboarding_status` and `ai_processing_consent_at` columns exist exactly as typed in `data-model.md`. ✅ Verified: `prisma migrate reset` applies cleanly; `AuditLogEntry` model also included (used by T011).
- [X] T009 [P] Implement PostgreSQL Row-Level Security policies for every tenant-scoped table per `data-model.md` Cross-Cutting Rules, in `apps/api/prisma/migrations/`
  - **Acceptance**: A test query executed with `app.tenant_id` set to tenant A returns zero rows belonging to tenant B, for every tenant-scoped table created so far. ✅ Verified via `test/integration/rls.spec.ts` (3/3 passed): tenant-scoped isolation, platform_admin bypass, and fail-closed (no context → zero rows). Required a dedicated non-superuser `app_runtime` role — the official Postgres image makes `POSTGRES_USER` a superuser, which always bypasses RLS regardless of `FORCE ROW LEVEL SECURITY`.
- [X] T010 [P] Implement Identity module: session-based auth + RBAC roles (`owner`, `staff`, `platform_admin`) in `apps/api/src/identity/`
  - **Acceptance**: A logged-in `owner` session and a `staff` session are both issued and distinguishable server-side; an unauthenticated request to any protected route returns `401`. ✅ Verified via `test/integration/auth.spec.ts` (4/4 passed). Real credential verification (managed auth provider) is deferred per research.md §6; `/auth/dev-login` is a same-process session-issuing shim, disabled when `NODE_ENV=production`.
- [X] T011 [P] Implement `AuditLogEntry` model + append-only audit service in `apps/api/src/audit/`
  - **Acceptance**: The audit service exposes a `record(actor, action, entityType, entityId, payload)` call that persists a row; no update/delete method exists on the audit repository. ✅ Verified via `test/integration/audit.spec.ts` (3/3 passed), incl. an explicit test that no update/delete method exists.
- [X] T012 [P] Implement shared Redis client module (twin cache, pub/sub, job queue) in `apps/api/src/common/redis/`
  - **Acceptance**: A round-trip set/get against Redis succeeds from an integration test using the shared client. ✅ Verified via `test/integration/redis.spec.ts` (1/1 passed); also exercised indirectly by session storage in `auth.spec.ts`.
- [X] T013 [P] Implement structured error handling + logging middleware in `apps/api/src/common/`
  - **Acceptance**: An unhandled exception in any route returns a consistent JSON error shape and is logged with a request-correlation ID. ✅ Implemented (`CorrelationIdMiddleware` + `AllExceptionsFilter`); exercised by the 401/403/404 paths across all integration tests, which all return the `{error:{code,message,correlationId}}` shape.
- [X] T014 Implement service-to-service auth token between `apps/api` and `apps/ai-service` (for the AI service's callback writes)
  - **Acceptance**: A request to `apps/api`'s internal callback route without the shared service token returns `403`; with it, `200`. ✅ Verified via `test/integration/internal.spec.ts` (3/3 passed): missing token, wrong token, and correct token cases.
- [X] T015 [P] Scaffold SSE gateway (no events wired yet) in `apps/api/src/notification/`
  - **Acceptance**: `GET /events/stream` opens and holds a `text/event-stream` connection; a manually-published test event on the gateway reaches a connected client. ✅ Verified via `src/notification/notification.service.spec.ts` (1/1 passed): a published event reaches only the matching tenant's subscriber. Real producers (`twin.updated`, `alert.created`) wire in during US1/US2 (T034, T050).

**Checkpoint**: Foundation ready — user story implementation may begin.

---

## Phase 3: User Story 1 - See a live view of the supply chain (Priority: P1) 🎯 MVP

**Goal**: SME owner onboards, connects data, and sees a live digital twin
(inventory, orders, suppliers, logistics) in one place.

**Independent Test**: Onboard a test SME with sample inventory/order/
supplier/logistics data (manual entry or CSV) and confirm the twin view
reflects it accurately and updates without manual refresh (spec.md US1
Acceptance Scenarios 1–2); confirm stale-data flagging (Scenario 3).

### Tests for User Story 1

- [X] T016 [P] [US1] Contract test for `POST /tenants` in `apps/api/test/contract/tenants.spec.ts`
  - **Acceptance**: Asserts request/response shapes match `contracts/api.yaml`'s `Tenant` schema; fails before the endpoint exists. ✅ Verified (2/2 passed).
- [X] T017 [P] [US1] Contract test for `POST /data-sources/csv-upload` in `apps/api/test/contract/data-sources.spec.ts`
  - **Acceptance**: Asserts `202` + `{data_source_id, status: "processing"}` shape per `contracts/api.yaml`. ✅ Verified (2/2 passed).
- [X] T018 [P] [US1] Contract test for `GET/POST /inventory-items` in `apps/api/test/contract/inventory-items.spec.ts`
  - **Acceptance**: Asserts `InventoryItemInput`/`InventoryItem` schema conformance for both verbs. ✅ Verified (2/2 passed).
- [X] T019 [P] [US1] Contract test for `GET/POST /suppliers` in `apps/api/test/contract/suppliers.spec.ts`
  - **Acceptance**: Asserts `SupplierInput`/`Supplier` schema conformance, incl. `kind: primary|backup`. ✅ Verified (2/2 passed).
- [X] T020 [P] [US1] Contract test for `GET /twin` in `apps/api/test/contract/twin.spec.ts`
  - **Acceptance**: Asserts response matches `TwinSnapshot` schema, incl. `stale_data_warnings` array. ✅ Verified (1/1 passed).
- [X] T021 [P] [US1] Integration test: onboard → connect data → twin reflects it, in `apps/api/test/integration/twin-view.spec.ts`
  - **Acceptance**: Covers spec.md US1 Acceptance Scenarios 1 and 2 end-to-end (twin updates without manual refresh after a supplier status change). ✅ Verified (2/2 passed) — Scenario 2 implemented via the actual SSE `twin.updated` event (no endpoint exists yet to directly mutate supplier status, so the test exercises the same invalidate+notify code path a status change would use).
- [X] T022 [P] [US1] Integration test: stale-data flagging in `apps/api/test/integration/stale-data.spec.ts`
  - **Acceptance**: Covers US1 Acceptance Scenario 3 and the "connected data source stops updating" Edge Case; asserts `DataSource.status` flips to `stale` and `GET /twin` surfaces it. ✅ Verified (1/1 passed).
- [X] T023 [P] [US1] RLS tenant-isolation integration test in `apps/api/test/integration/tenant-isolation.spec.ts`
  - **Acceptance**: Two tenants' inventory/supplier data never appear in each other's `GET /twin` response; directly verifies FR-011 and SC-006. ✅ Verified (2/2 passed).

### Implementation for User Story 1

- [X] T024 [P] [US1] Create `Supplier` entity/migration in `apps/api/src/ingestion/entities/supplier.entity.ts` per `data-model.md`
  - **Acceptance**: Migration applies cleanly; RLS policy from T009 covers this table. ✅ Verified: entity in `prisma/schema.prisma`, RLS added in the `user_story_1_twin` migration (extending T009's pattern), smoke-tested via `psql` as `app_runtime`.
- [X] T025 [P] [US1] Create `InventoryItem` entity/migration in `apps/api/src/ingestion/entities/inventory-item.entity.ts`
  - **Acceptance**: Migration applies cleanly; `sku` unique per tenant is enforced at the DB level. ✅ Verified: `@@unique([tenantId, sku])`.
- [X] T026 [P] [US1] Create `Order` + `OrderLineItem` entities/migrations in `apps/api/src/ingestion/entities/order.entity.ts`
  - **Acceptance**: `OrderLineItem.inventory_item_id` FK constraint enforced; `Order.status` enum matches `data-model.md`. ✅ Verified: migration applies cleanly; RLS on `order_line_items` scoped via the parent `orders` row (no `tenant_id` of its own).
- [X] T027 [P] [US1] Create `LogisticsEvent` entity/migration in `apps/api/src/ingestion/entities/logistics-event.entity.ts`
  - **Acceptance**: FK to `Order` enforced; migration applies cleanly. ✅ Verified: same parent-scoped RLS pattern as `order_line_items`.
- [X] T028 [US1] Implement `TenantService` + `POST /tenants` in `apps/api/src/identity/tenant.service.ts` (depends on T008, T010)
  - **Acceptance**: T016 passes; created tenant has `onboarding_status = "pending"`. ✅ Verified via T016 + a live curl smoke test against the running dev server.
- [X] T029 [US1] Implement CSV upload parsing + async ingestion pipeline via Redis queue in `apps/api/src/ingestion/csv-upload.service.ts` (depends on T012, T024–T027) — implemented as `csv-ingestion.queue.ts` (BullMQ, not a plain service) per research.md §5's Redis job-queue decision
  - **Acceptance**: T017 passes; a valid CSV of inventory rows results in `InventoryItem` rows linked to the created `DataSource`. ✅ Verified via T017 and T022 (which waits on the real async worker to finish before asserting).
- [X] T030 [US1] Implement manual-entry endpoints (`GET/POST /inventory-items`, `/suppliers`) in `apps/api/src/ingestion/inventory.controller.ts` and `supplier.controller.ts` (depends on T024, T025)
  - **Acceptance**: T018 and T019 pass. ✅ Verified.
- [X] T031 [US1] Implement Twin read-model aggregation service (Redis-cached snapshot over inventory/orders/suppliers/logistics) in `apps/api/src/twin/twin.service.ts` (depends on T024–T027, T012)
  - **Acceptance**: Snapshot recomputes on relevant writes within the perf budget implied by SC-003; matches `TwinSnapshot` schema. ✅ Verified: cache explicitly invalidated + recomputed on every write (T021 Scenario 2), not just TTL-based.
- [X] T032 [US1] Implement `GET /twin` endpoint in `apps/api/src/twin/twin.controller.ts` (depends on T031)
  - **Acceptance**: T020 and T021 pass. ✅ Verified.
- [X] T033 [US1] Implement data-freshness/staleness checker job in `apps/api/src/ingestion/freshness-checker.service.ts` (depends on T029)
  - **Acceptance**: T022 passes; `DataSource.status` transitions `active → stale` after the configured threshold with no new sync. ✅ Verified; also invalidates the twin cache for affected tenants (a real gap found and fixed during implementation — the cron job wasn't originally wired to T034's notify path).
- [X] T034 [US1] Wire `twin.updated` SSE event emission on relevant writes in `apps/api/src/notification/twin-events.service.ts` (depends on T015, T031)
  - **Acceptance**: A connected SSE client receives a `twin.updated` event within seconds of an underlying data change. ✅ Verified via T021 Scenario 2 (event received via `NotificationService.streamFor`, same code path the real SSE HTTP endpoint uses).
- [X] T035 [US1] Build onboarding UI (business details + manual entry / CSV upload) in `apps/web/app/onboarding/`
  - **Acceptance**: A user can complete onboarding and connect data through the UI alone, no API tool required (FR-009). ✅ Verified: `next build` succeeds, page serves 200 with expected form content, and a full curl-driven walk of the same flow the UI calls (onboard → dev-login → add item/supplier → twin) succeeds end-to-end against the real running dev server.
- [X] T036 [US1] Build Digital Twin dashboard (inventory/orders/suppliers/logistics + stale-data indicator, live via SSE) in `apps/web/app/twin/page.tsx` (depends on T032, T034)
  - **Acceptance**: View updates in place when underlying data changes, without a manual page refresh. ✅ Verified: `next build` succeeds, page serves 200; subscribes to `/events/stream` and re-fetches on `twin.updated` rather than polling. Full visual browser verification wasn't possible in this environment (no browser automation tool available this session) — verified via build success, route smoke test, and the shared backend code path already covered by T021's SSE test.

**Checkpoint**: User Story 1 fully functional and independently
demoable — MVP delivers live supply-chain visibility.

---

## Phase 4: User Story 2 - Get an early warning before a disruption hits (Priority: P2)

**Goal**: SME owner receives a plain-language alert ≥48 hours before a
predicted disruption.

**Independent Test**: Feed a known disruption pattern into the system and
confirm an alert appears ≥48h before the simulated impact date, in plain
language (spec.md US2 Acceptance Scenarios 1–2); confirm false positives
are shown transparently in history (Scenario 3).

### Tests for User Story 2

- [X] T037 [P] [US2] Contract test for `GET /predictions`, `GET /predictions/{id}` in `apps/api/test/contract/predictions.spec.ts`
  - **Acceptance**: Response matches `DisruptionPrediction` schema, incl. `status` filter query param. ✅ Verified (4/4 passed).
- [X] T038 [P] [US2] Contract test for `GET /alerts`, `GET /alerts/{id}` in `apps/api/test/contract/alerts.spec.ts`
  - **Acceptance**: Response matches `Alert`/`AlertDetail` schema; list is ordered severity desc then created_at desc per the contract. ✅ Verified (4/4 passed).
- [X] T039 [P] [US2] Unit test: Prediction Agent enforces ≥48h lead time given a fixture signal, in `apps/ai-service/tests/test_prediction_agent.py`
  - **Acceptance**: Asserts `predicted_impact_at - created_at >= 48h` holds for every prediction the agent emits, and that predictions violating it are rejected before leaving the agent. ✅ Verified (6/6 passed, incl. exact-boundary and markdown-fenced-reply cases); mypy strict + ruff clean.
- [X] T040 [P] [US2] Integration test: simulated supplier-delay scenario produces an alert ≥48h ahead, in `apps/api/test/integration/disruption-alert.spec.ts`
  - **Acceptance**: Covers US2 Acceptance Scenarios 1–2, incl. plain-language content assertions (no raw statistical/technical jargon). ✅ Verified (4/4 passed) — includes a regression test for a real FK-error-handling gap found during manual cross-process verification (see T046 notes).
- [X] T041 [P] [US2] Integration test: false-positive prediction appears in alert history, in `apps/api/test/integration/prediction-history.spec.ts`
  - **Acceptance**: Covers US2 Acceptance Scenario 3 and FR-012. ✅ Verified (3/3 passed).

### Implementation for User Story 2

- [X] T042 [P] [US2] Create `DisruptionPrediction` entity/migration in `apps/api/src/action/entities/disruption-prediction.entity.ts` — implemented in `prisma/schema.prisma` per this project's Prisma-only entity convention (established in T024-T027)
  - **Acceptance**: Migration applies cleanly; `status` enum matches `data-model.md`. ✅ Verified; RLS extended per T009's pattern.
- [X] T043 [P] [US2] Create `Alert` entity/migration (severity, status, channels_sent) in `apps/api/src/action/entities/alert.entity.ts` — implemented in `prisma/schema.prisma`
  - **Acceptance**: Migration applies cleanly; state-transition set matches `data-model.md`'s Alert state transitions. ✅ Verified; also added `title`/`summary` columns (documented extension for T048's plain-language content, not in the original data-model.md field list).
- [X] T044 [US2] Implement mock supplier/logistics signal adapters in `apps/ai-service/app/adapters/` (depends on T004)
  - **Acceptance**: Adapters expose the same interface a live integration would (research.md §7); seeded scenarios are selectable for demo/testing. ✅ Verified: `supplier_delay_signal`, `port_congestion_signal`, `demand_spike_signal` builders in `signals.py`.
- [X] T045 [US2] Implement Prediction Agent (Claude API call; enforces ≥48h lead time at creation) in `apps/ai-service/app/agents/prediction_agent.py` (depends on T044, T039)
  - **Acceptance**: T039 passes; agent output includes `type`, `confidence_score`, `affected_*`, and `created_by_agent` identifier for auditability. ✅ Verified. The ≥48h floor is enforced deterministically in code (not left to the LLM); Claude is used only for confidence/rationale.
- [X] T046 [US2] Implement AI-service → `apps/api` callback to persist predictions, in `apps/ai-service/app/callbacks/predictions.py` + `apps/api/src/internal/predictions-callback.controller.ts` (internal) (depends on T042, T014)
  - **Acceptance**: A prediction generated by T045 is persisted via the authenticated internal callback and produces an `AuditLogEntry` (T011). ✅ Verified via a real cross-process test: `apps/ai-service`'s actual `PredictionAgent` + `PredictionCallbackClient` (stub Claude client, real HTTP) against a live `apps/api` dev server — found and fixed two real gaps: (1) a stale/unknown `affected_supplier_id` leaked a raw Prisma `500` instead of a clean `422` (fixed with explicit FK-violation handling + a regression test); (2) `createTestApp()`'s test harness never registered `AllExceptionsFilter`, so Jest tests were silently exercising a different error-response shape than production — fixed by mirroring `main.ts`'s bootstrap exactly, which also strengthened every other error-path assertion across the whole suite.
- [X] T047 [US2] Implement alert-generation service (Alert from DisruptionPrediction, severity computation, concurrent-alert ranking) in `apps/api/src/action/alert.service.ts` (depends on T043, T046)
  - **Acceptance**: FR-015 — given two simultaneous predictions of different severity, `GET /alerts` returns the higher-severity one first. ✅ Verified (`alerts.spec.ts`).
- [X] T048 [US2] Implement plain-language alert content formatting in `apps/api/src/action/alert-formatter.service.ts` (depends on T047)
  - **Acceptance**: Alert `title`/`summary` fields contain no technical/statistical jargon (T040's assertion). ✅ Verified; template-based (not a second LLM call) since the Prediction Agent's `rationale` already carries the open-ended reasoning.
- [X] T049 [US2] Implement `GET /predictions`, `GET /predictions/{id}`, `GET /alerts`, `GET /alerts/{id}` endpoints in `apps/api/src/action/predictions.controller.ts` + `alerts.controller.ts` (depends on T042, T043)
  - **Acceptance**: T037 and T038 pass. ✅ Verified.
- [X] T050 [US2] Wire `alert.created` SSE event + at least one direct notification channel (e.g., email) in `apps/api/src/notification/alert-notifier.service.ts` (depends on T015, T047)
  - **Acceptance**: FR-014 — a new alert reaches a connected client via SSE and via the configured direct channel within the delivery budget backing SC-003. ✅ Verified; email channel is a logged mock for the MVP pilot (research.md §7's "mock for MVP" pattern — no real provider configured), `channels_sent` still recorded accurately.
- [X] T051 [US2] Implement alert escalation job (re-notify/raise priority as impact window approaches) in `apps/api/src/action/alert-escalation.service.ts` (depends on T047)
  - **Acceptance**: FR-016 — an unacted `new`/`acknowledged` alert transitions to `escalated` and re-fires notification as its `predicted_impact_at` approaches. ✅ Implemented (same cron-guarded-in-test pattern as `FreshnessCheckerService`, T033).
- [X] T052 [US2] Build alert inbox UI (severity-ranked list + detail view with plain-language reasoning) in `apps/web/app/alerts/` (depends on T049)
  - **Acceptance**: Matches US2 Acceptance Scenario 2 — owner can read what's at risk and by when without technical jargon. ✅ Verified: `next build` succeeds, `/alerts` and `/alerts/[id]` serve 200; detail page honestly shows "no recommendation yet" rather than fabricating one (Recommendation is a US3 entity, not yet built).
- [X] T053 [US2] Build prediction/alert history view (incl. false positives) in `apps/web/app/alerts/history/` (depends on T049)
  - **Acceptance**: Matches US2 Acceptance Scenario 3 and FR-012. ✅ Verified: `next build` succeeds, `/alerts/history` serves 200.

**Checkpoint**: User Stories 1 and 2 both work independently — predictive
alerting is demoable end to end.

---

## Phase 5: User Story 3 - Act on a recommended contingency plan (Priority: P3)

**Goal**: SME owner sees a step-by-step contingency plan with alternative
sourcing options and can accept/modify/dismiss it.

**Independent Test**: Trigger a disruption alert (as in US2) and confirm
the owner is shown a contingency plan with ≥1 alternative sourcing option
(or fallback guidance if none exists), can record a decision, and that
decision persists (spec.md US3 Acceptance Scenarios 1–3).

### Tests for User Story 3

- [X] T054 [P] [US3] Contract test for `POST /alerts/{id}/decision` in `apps/api/test/contract/alert-decision.spec.ts`
  - **Acceptance**: Asserts `accepted|modified|dismissed` handling and that `modified` requires `modification_notes`. ✅ Verified (5/5 passed), incl. 404 when an alert has no recommendation yet.
- [X] T055 [P] [US3] Contract test for `GET/POST /auto-trigger-rules`, incl. `403` for non-owner, in `apps/api/test/contract/auto-trigger-rules.spec.ts`
  - **Acceptance**: A `staff`-role request to `POST /auto-trigger-rules` returns `403`; an `owner`-role request returns `201`. ✅ Verified (4/4 passed) — covers both GET and POST for both roles.
- [X] T056 [P] [US3] Contract test for `GET /audit-logs` in `apps/api/test/contract/audit-logs.spec.ts`
  - **Acceptance**: Only `owner`/`platform_admin` roles can access; response matches `AuditLogEntry` schema. ✅ Verified (3/3 passed).
- [X] T057 [P] [US3] Unit test: Sourcing Recommendation Agent prefers a registered backup supplier before the Local Supplier Directory fallback (FR-006), in `apps/ai-service/tests/test_sourcing_recommendation_agent.py`
  - **Acceptance**: Given a tenant with a suitable registered backup, the agent never returns a directory entry; given none, it does. ✅ Verified (4/4 passed); additionally confirmed against a live server E2E (agent chose the own-backup over 2 available directory entries).
- [X] T058 [P] [US3] Unit test: Contingency Plan Agent produces plain-language steps, incl. no-alternative fallback guidance, in `apps/ai-service/tests/test_contingency_plan_agent.py`
  - **Acceptance**: Covers US3 Acceptance Scenario 3 — plan is still generated when no viable alternative exists. ✅ Verified (4/4 passed); the no-alternative test asserts the prompt itself makes the situation explicit, not just that some output came back.
- [X] T059 [P] [US3] Integration test: decision recording + audit log, in `apps/api/test/integration/recommendation-decision.spec.ts`
  - **Acceptance**: Covers US3 Acceptance Scenario 2; a decision produces exactly one `AuditLogEntry` referencing the `Recommendation`. ✅ Verified (2/2 passed).
- [X] T060 [P] [US3] Integration test: opt-in auto-trigger executes within conditions and is audit-logged, in `apps/api/test/integration/auto-trigger.spec.ts`
  - **Acceptance**: FR-005 — a matching rule triggers an action automatically; the resulting `Recommendation.auto_triggered = true` and an `AuditLogEntry` exists. ✅ Verified (3/3 passed). Note: an earlier version of this suite shared one tenant across cases, so leftover rules from the first test made a later "should NOT auto-trigger" case pass for the wrong reason — fixed with per-test tenant isolation rather than by weakening the assertion.

### Implementation for User Story 3

- [X] T061 [P] [US3] Create `Recommendation` entity/migration in `prisma/schema.prisma` (Prisma-only entity convention, per T024-T027)
  - **Acceptance**: Enforces "exactly one or neither of `recommended_supplier_id`/`recommended_directory_entry_id`" per `data-model.md`. ✅ Enforced as a real DB `CHECK` constraint (`recommendations_at_most_one_source_chk`), not just application-layer trust. RLS scoped via the parent alert (no own `tenant_id`).
- [X] T062 [P] [US3] Create `LocalSupplierDirectoryEntry` entity/migration + seed data in `prisma/schema.prisma` + the US3 migration
  - **Acceptance**: Seed script inserts ≥1 verified entry per pilot-relevant sector (research.md §7). ✅ 5 verified UAE entries seeded across retail (2), food (2), logistics (1). Deliberately global/not tenant-scoped with no tenant-facing write route — documented in the migration.
- [X] T063 [P] [US3] Create `AutoTriggerRule` entity/migration in `prisma/schema.prisma`
  - **Acceptance**: `created_by_user_id` FK enforced; migration applies cleanly. ✅ Verified; RLS applied per T009's pattern.
- [X] T064 [US3] Implement Sourcing Recommendation Agent (own backups first, directory fallback) in `apps/ai-service/app/agents/sourcing_recommendation_agent.py` (depends on T057, T062)
  - **Acceptance**: T057 passes. ✅ Implemented as a deterministic selection policy (no LLM call) — same reasoning as the Prediction Agent's ≥48h floor: FR-006 is a hard product rule, not a judgment call to delegate.
- [X] T065 [US3] Implement Contingency Plan Agent (step-by-step plain-language generation, incl. no-alternative fallback) in `apps/ai-service/app/agents/contingency_plan_agent.py` (depends on T058)
  - **Acceptance**: T058 passes. ✅ Verified. Shared Claude-JSON parsing extracted to `app/agents/claude_json.py` rather than duplicated from the Prediction Agent.
- [X] T066 [US3] Extend AI-service callback to persist `Recommendation` alongside its `Alert`, in `apps/ai-service/app/callbacks/recommendations.py` + `apps/api/src/internal/recommendations-callback.controller.ts` (depends on T061, T046)
  - **Acceptance**: Every generated recommendation is persisted with an `AuditLogEntry` (Principle IV / user's explicit audit requirement). ✅ Verified (4/4 pytest + live cross-process E2E). `POST /internal/predictions` now also returns `sourcing_candidates` so the agent can apply FR-006 without apps/api owning that policy.
- [X] T067 [US3] Implement `POST /alerts/{id}/decision` + decision recording in `apps/api/src/action/alert-decision.controller.ts` (depends on T061)
  - **Acceptance**: T054 and T059 pass. ✅ Verified; also flips the parent `Alert.status` to `acted_on`/`dismissed`.
- [X] T068 [US3] Implement `AutoTriggerRule` CRUD with owner-only enforcement in `apps/api/src/action/auto-trigger-rule.controller.ts` (depends on T063, T010)
  - **Acceptance**: T055 passes. ✅ Verified via the existing `RolesGuard` (owner-only on both GET and POST).
- [X] T069 [US3] Implement auto-trigger evaluation service (matches conditions, executes action, writes audit log) in `apps/api/src/action/auto-trigger-evaluator.service.ts` (depends on T068, T011, T064)
  - **Acceptance**: T060 passes. ✅ Verified; opt-in only (never fires without an explicit enabled matching rule), and every auto-trigger names the rule that fired in its audit entry.
- [X] T070 [US3] Implement `GET /audit-logs` endpoint (owner + platform_admin only) in `apps/api/src/audit/audit-log.controller.ts` (depends on T011)
  - **Acceptance**: T056 passes. ✅ Verified; live E2E showed the full 5-entry trail (onboarding → prediction → alert → recommendation → decision).
- [X] T071 [US3] Build contingency plan / recommendation UI (steps, accept/modify/dismiss) in `apps/web/app/alerts/[id]/page.tsx` (depends on T052, T067) — implemented in the existing route page rather than a separate `plan.tsx`, since App Router renders `page.tsx` for a route
  - **Acceptance**: Matches US3 Acceptance Scenarios 1–3, incl. the no-alternative fallback state. ✅ Verified: `next build` succeeds; shows the recommended alternative (distinguishing own-backup vs. directory), numbered steps, an auto-triggered notice, and accept / "I'll do something different" (with notes) / dismiss. Live E2E confirmed the real data renders through the same API shape.
- [X] T072 [US3] Build auto-trigger rule settings UI (owner-only) in `apps/web/app/settings/auto-trigger-rules/page.tsx` (depends on T068) — directory + `page.tsx`, per App Router convention
  - **Acceptance**: A `staff`-role user cannot see/access rule-editing controls in the UI. ✅ Verified: `next build` succeeds; the page checks `/auth/me` and renders a plain-language "only the business owner can set this up" message for staff, never the form (server still enforces `403` independently). Confidence thresholds are presented in plain language ("Only when we're very sure") rather than raw numbers, per Constitution Principle VI.

**Checkpoint**: All three user stories independently functional — the
full "predict → recommend → act" loop is demoable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Pilot-readiness hardening across all stories.

- [X] T073 [P] Add rate limiting + input validation hardening across all `apps/api` endpoints
  - **Acceptance**: Every mutating endpoint rejects malformed payloads with `400` and is rate-limited per tenant. ✅ Verified. Input validation was already global (`ValidationPipe` + per-DTO `class-validator` rules, covered by existing contract tests asserting `400`). Rate limiting added via `@nestjs/throttler` with a custom `TenantThrottlerGuard` that keys on tenant (falling back to IP for unauthenticated calls like signup) — 3/3 tests in `rate-limit.spec.ts` cover the 429 boundary, per-tenant isolation, and the IP fallback. Skipped under `NODE_ENV=test`: the whole suite shares one source IP so unauthenticated calls would exhaust a single shared budget, and the storage's expiry timers stalled Jest teardown; the guard is covered directly by its own spec instead.
- [X] T074 [P] Serve `contracts/api.yaml` via Swagger UI in `apps/api`
  - **Acceptance**: `GET /docs` renders the current contract, matching `contracts/api.yaml`. ✅ Verified live (`200`, Swagger UI rendered, log confirms it loaded the real contract file). Serves the hand-written contract rather than generating from decorators, so the contract stays the source of truth per Principle II. **This task found a real defect**: `contracts/api.yaml` had been syntactically invalid YAML (an unquoted `{...}` in a description at line 436 parsed as a flow mapping) since it was first authored — nothing had ever parsed it. Fixed, and `api-contract-valid.spec.ts` (3 tests) now fails CI if the contract breaks again.
- [X] T075 [P] Performance pass: verify `GET /twin` and alert-delivery paths meet the SC-003 "act within 5 minutes" budget under a simulated 150-tenant load
  - **Acceptance**: Load test report checked into `specs/001-supply-chain-digital-twin/` shows p95 alert-delivery latency well under the 5-minute budget. ✅ `load-test-report.md` checked in. At full pilot scale (150 tenants, 3,000 inventory items): alert delivery p95 **234 ms**, twin read p95 **50 ms**, against a 300,000 ms budget (~1,280× headroom). Report is explicit that this is sequential latency on a dev laptop, not a concurrency/capacity measurement — that needs re-running on the deployed environment before the real pilot.
- [X] T076 [P] Plain-language UX audit across `apps/web` per Constitution Principle VI
  - **Acceptance**: No technical jargon ("API," "webhook," "SKU mapping," etc.) appears in primary user-facing copy. ✅ Audited all user-facing strings; found and fixed four real leaks: CSV column names shown verbatim in onboarding, raw `DataSource` enum values (`csv_upload`) in the twin's stale-data warning, raw alert `status`/`channels_sent` enums on the alert detail page, and raw severity levels (`critical`) in the alert inbox — now "Act now" / "Act soon" / "Keep an eye on it" / "Just so you know". Remaining matches for jargon terms are code identifiers, not visible copy.
- [X] T077 Run `quickstart.md` golden-path validation end-to-end (all 3 user stories) before pilot handoff
  - **Acceptance**: Every numbered step in `quickstart.md` §4 completes as described on a clean environment. ✅ Ran the full path against live services: onboarding → sample-CSV upload (5 items in the twin) → consent → prediction (72 h lead time) → sourcing agent picking the own-backup → 3-step plan → decision recorded (`acted_on`) → 7-entry audit trail. **Validation corrected the doc**, which described several things that never existed: `npm run db:migrate`/`db:seed` (real scripts are `prisma:migrate`, and seeding ships inside the migration), `uvicorn main:app` (actually `app.main:app`), a referenced-but-missing sample CSV (now added at `apps/api/test/fixtures/`), and no mention of `MIGRATE_DATABASE_URL`, port 5433, `docker compose up`, or the now-mandatory consent step. Also fixed a corrupted `websockets` package that prevented the AI service from starting at all.
- [X] T078 [P] Security review: confirm RLS policies (T009) and the AI-consent gate (`Tenant.ai_processing_consent_at`) are enforced on every relevant path
  - **Acceptance**: No tenant can reach `active` onboarding status without consent set; no endpoint bypasses RLS via a raw/unscoped query. ✅ **This review found the most significant gap in the project**: `ai_processing_consent_at` existed in the schema and `plan.md`'s Constitution Check named it as the mitigation for Principle V (the Claude API egress point) — but it was enforced *nowhere*. Every tenant's data could have been sent to a third-party model without consent. Fixed: added owner-only `POST /tenants/me/ai-consent` (audit-logged, and the only path to `active`), and hard gates on both `/internal/predictions` and `/internal/recommendations` that refuse with `403` for a non-consenting tenant. Covered by 6 tests in `ai-consent-gate.spec.ts`, including that a rejected call persists nothing and that staff cannot consent on the business's behalf. RLS was separately re-confirmed: every tenant-scoped table has `ENABLE`/`FORCE ROW LEVEL SECURITY`, all runtime queries go through `withTenantContext`, and `rls.spec.ts` proves it fails closed (no context ⇒ zero rows).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - US1 (P1) has no dependency on US2/US3.
  - US2 (P2) reuses US1's ingestion entities (Supplier, InventoryItem) but
    adds its own Prediction/Alert entities — can start once Foundational is
    done; does not require US1's UI to be finished, only its entities.
  - US3 (P3) depends on US2's Alert entity existing (a Recommendation
    attaches to an Alert) but its own agents/entities are independent work.
  - Recommended order: US1 → US2 → US3 (matches priority and natural data
    dependency), but US2/US3 backend work can start in parallel with US1's
    frontend work once Foundational is done, if staffed.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests written first, confirmed failing, then implementation (Constitution
  Principle X).
- Entities before services; services before endpoints/agents; endpoints
  before UI.
- Story complete and independently demoable before moving to the next.

### Parallel Opportunities

- All Setup tasks marked [P] (T002–T007) run together once T001 exists.
- All Foundational [P] tasks (T009–T013, T015) run together once T008
  exists; T014 needs T003+T004 (both apps scaffolded) first.
- Within US1: all contract tests (T016–T020) run in parallel; all entity
  tasks (T024–T027) run in parallel; T028–T030 can run in parallel with
  each other once their respective entities exist.
- Within US2: T037–T041 (tests) in parallel; T042–T043 (entities) in
  parallel.
- Within US3: T054–T060 (tests) in parallel; T061–T063 (entities) in
  parallel.
- Once Foundational is done, a second developer can start US2's/US3's
  entity and agent tests (T037–T041, T054–T060) in parallel with US1
  implementation, since those tests only need the Foundational phase, not
  a finished US1.
- All Polish [P] tasks (T073–T076, T078) run in parallel; T077 runs last
  and alone (it validates everything above it).

---

## Parallel Example: User Story 1

```bash
# Launch all US1 contract tests together:
Task: "Contract test for POST /tenants in apps/api/test/contract/tenants.spec.ts"
Task: "Contract test for POST /data-sources/csv-upload in apps/api/test/contract/data-sources.spec.ts"
Task: "Contract test for GET/POST /inventory-items in apps/api/test/contract/inventory-items.spec.ts"
Task: "Contract test for GET/POST /suppliers in apps/api/test/contract/suppliers.spec.ts"
Task: "Contract test for GET /twin in apps/api/test/contract/twin.spec.ts"

# Launch all US1 entity creation together:
Task: "Create Supplier entity/migration in apps/api/src/ingestion/entities/supplier.entity.ts"
Task: "Create InventoryItem entity/migration in apps/api/src/ingestion/entities/inventory-item.entity.ts"
Task: "Create Order + OrderLineItem entities/migrations in apps/api/src/ingestion/entities/order.entity.ts"
Task: "Create LogisticsEvent entity/migration in apps/api/src/ingestion/entities/logistics-event.entity.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run T016–T023 tests, then `quickstart.md` steps
   for onboarding + twin view
5. Demo the live digital twin — already a defensible pilot artifact

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate independently → demo (MVP: "we can see our supply
   chain live")
3. Add US2 → validate independently → demo (adds: "we get warned 48h
   ahead")
4. Add US3 → validate independently → demo (adds: "and here's what to do
   about it") — this is the full challenge submission demo
5. Polish → pilot-ready for 150 du SME partners

### Parallel Team Strategy

With 2–3 developers, after Foundational is done:
- Developer A: US1 (ingestion + twin, full stack)
- Developer B: US2 backend/AI (Prediction Agent + alert pipeline) —
  entities and agent tests don't require US1's UI to be finished
- Developer C: US3 backend/AI (Recommendation + Contingency Plan agents) —
  can build against US2's Alert contract test/schema before US2's full
  implementation lands
- Frontend work (T035–T036, T052–T053, T071–T072) sequences after each
  story's backend contract is stable, but can be one developer moving
  across stories in priority order.

---

## Notes

- [P] tasks touch different files with no unmet dependency.
- [Story] label maps every user-story-phase task to US1/US2/US3 for
  traceability back to `spec.md`.
- Every AI-agent-adjacent task (prediction, recommendation, contingency
  plan, auto-trigger) has a paired audit-logging acceptance criterion,
  per Constitution Principle IV and the user's explicit requirement.
- Commit after each task or logical group; stop at any checkpoint to
  validate a story independently before continuing.
- Avoid: skipping the Foundational phase, building a story's UI before its
  backend contract tests pass, or bypassing RLS with a raw unscoped query.
