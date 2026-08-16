---
id: 0009
title: Implement Phase 6 Polish
stage: green
date: 2026-08-16
surface: agent
model: claude-opus-5
feature: 001-supply-chain-digital-twin
branch: 001-supply-chain-digital-twin
user: my5757980@gmail.com
command: /sp.implement
labels: ["implement", "polish", "security", "consent", "rate-limiting", "load-test", "ux-audit"]
links:
  spec: specs/001-supply-chain-digital-twin/spec.md
  ticket: https://challenges.ignyte.ae/competition/00B42B34-228F-F111-B337-6045BD14DEDF
  adr: null
  pr: null
files:
 - apps/api/src/identity/tenant.service.ts
 - apps/api/src/identity/tenant.controller.ts
 - apps/api/src/internal/predictions-callback.controller.ts
 - apps/api/src/internal/recommendations-callback.controller.ts
 - apps/api/src/internal/internal.module.ts
 - apps/api/src/common/tenant-throttler.guard.ts
 - apps/api/src/common/swagger.ts
 - apps/api/src/app.module.ts
 - apps/api/src/main.ts
 - apps/api/package.json
 - apps/api/test/helpers/test-app.ts
 - apps/api/test/fixtures/sample-inventory.csv
 - apps/api/test/fixtures/sample-suppliers.csv
 - apps/api/test/load/pilot-load.ts
 - apps/web/app/onboarding/page.tsx
 - apps/web/app/twin/page.tsx
 - apps/web/app/alerts/page.tsx
 - apps/web/app/alerts/[id]/page.tsx
 - specs/001-supply-chain-digital-twin/contracts/api.yaml
 - specs/001-supply-chain-digital-twin/quickstart.md
 - specs/001-supply-chain-digital-twin/load-test-report.md
 - specs/001-supply-chain-digital-twin/tasks.md
tests:
 - apps/api/test/integration/ai-consent-gate.spec.ts (Jest, 6 passed)
 - apps/api/test/integration/rate-limit.spec.ts (Jest, 3 passed)
 - apps/api/test/contract/api-contract-valid.spec.ts (Jest, 3 passed)
 - full suites — apps/api 74/74 across 27 suites; apps/ai-service 21/21
 - manual golden-path validation of all 5 quickstart steps against live services
 - pilot-scale load test — 150 tenants, 3,000 items
---

## Prompt

(Continuation of the /sp.implement session; user said "continue karooo" to
proceed into Phase 6 — Polish & Cross-Cutting Concerns, T073–T078.)

## Response snapshot

Phase 6 was mostly a review phase, and the reviews found more than the polish did.

**T078 (security review) found the most serious gap in the project.** `Tenant.ai_processing_consent_at` existed in the schema, and `plan.md`'s Constitution Check explicitly named it as the mitigation for Principle V — the Claude API being the system's one third-party data-egress point. Grepping for its enforcement returned only the schema definition and a mapper: it was enforced nowhere. Every tenant's supply-chain data could have gone to a third-party model without anyone having consented. Fixed properly rather than patched: an owner-only, audit-logged `POST /tenants/me/ai-consent` that is also the only route to `active` onboarding status, plus hard `403` gates on both AI callbacks. Six tests cover it, including that a rejected call persists nothing and that a staff user cannot consent on the business's behalf. Adding the gate correctly broke every existing test whose tenant had never consented — the fix was to make the shared onboarding helper grant consent by default with an explicit opt-out, so the gate stays real rather than being weakened.

**T074 found that the API contract had been invalid YAML the whole time.** Wiring `/docs` to serve `contracts/api.yaml` surfaced a parse error at line 436: an unquoted `{"max_order_value": ...}` inside a `description` was being read as a flow mapping. That file is the source of truth under Principle II and nothing had ever parsed it. Fixed, then added `api-contract-valid.spec.ts` so a malformed contract fails CI instead of silently disabling the docs.

**T077 found the quickstart documented several things that never existed**: `npm run db:migrate`/`db:seed` (the real script is `prisma:migrate`, and seeding ships inside the US3 migration), `uvicorn main:app` (actually `app.main:app`), and a "seeded sample CSV" with no such file. It also omitted `MIGRATE_DATABASE_URL`, port 5433, `docker compose up`, and the now-mandatory consent step. Rewrote it against reality, added the missing fixtures, and ran the whole path live: onboarding → CSV upload (5 items in the twin) → consent → prediction at 72 h lead time → sourcing agent choosing the own-backup over the directory → 3-step plan → decision recorded → 7-entry audit trail. Also had to repair a corrupted `websockets` package that made the AI service unstartable.

T073 added per-tenant rate limiting via a custom `TenantThrottlerGuard` (tenant-keyed, IP fallback for signup). It's skipped under `NODE_ENV=test` — the suite shares one source IP so unauthenticated calls would exhaust a single budget, and the storage's expiry timers stalled Jest teardown badly enough to hang the run; the guard is covered directly by its own spec with a tight limit instead. T075's load test at full pilot scale (150 tenants, 3,000 items) gave alert-delivery p95 of 234 ms and twin-read p95 of 50 ms against a 5-minute budget — about 1,280× headroom — with the report explicit that this is sequential latency on a laptop, not a capacity number. T076's jargon audit found four real leaks of raw enum values into user-facing copy (`csv_upload`, `acted_on`, `in_app`, `critical`) and replaced them with plain language.

## Outcome

- ✅ Impact: All 78 tasks complete. The feature is pilot-ready, and the two guarantees the constitution cares most about — tenant isolation and consent-bound third-party processing — are now genuinely enforced rather than only modelled.
- 🧪 Tests: 12 new Jest tests; suites now 74/74 across 27 (api) and 21/21 (ai-service). `tsc`/`eslint`/`nest build`/`next build`/`mypy`/`ruff` all clean.
- 📁 Files: ~22 new/modified, incl. `load-test-report.md` and a rewritten `quickstart.md`.
- 🔁 Next prompts: `/sp.analyze` for a cross-artifact consistency pass, or `/sp.adr` to record the architectural decisions this feature accumulated (the consent gate and the RLS/`app_runtime` split are both ADR-worthy).
- 🧠 Reflection: Three of the six polish tasks existed to check something, and all three found a defect that had survived every prior phase — including a Principle V violation that the plan document itself asserted was mitigated. Writing "mitigated by X" in a plan created a false sense that X existed. Worth treating any claimed mitigation as unverified until a test exercises it.

## Evaluation notes (flywheel)

- Failure modes observed: (1) a constitutional guarantee documented as mitigated but never implemented; (2) the source-of-truth API contract being unparseable and nobody noticing; (3) setup documentation describing commands and files that never existed; (4) throttler expiry timers hanging Jest teardown; (5) a corrupted Python package from an earlier interrupted install.
- Graders run and results (PASS/FAIL): Jest 74/74 — PASS; pytest 21/21 — PASS; `tsc`/`eslint` (api, web) — PASS; `mypy`/`ruff` (ai-service) — PASS; `nest build`/`next build` — PASS; live golden path (5 steps) — PASS; pilot load test — PASS (p95 234 ms vs 300,000 ms budget).
- Prompt variant (if applicable): N/A
- Next experiment (smallest change to try): When a plan says "mitigated by X", add the test for X in the same commit that writes the claim — the gap here existed purely because the assertion and its enforcement were separated by five phases.
