---
id: 0007
title: Implement Phase 4 User Story 2
stage: green
date: 2026-08-15
surface: agent
model: claude-sonnet-5
feature: 001-supply-chain-digital-twin
branch: 001-supply-chain-digital-twin
user: my5757980@gmail.com
command: /sp.implement
labels: ["implement", "user-story-2", "ai-agent", "claude", "predictions", "alerts", "sse"]
links:
  spec: specs/001-supply-chain-digital-twin/spec.md
  ticket: https://challenges.ignyte.ae/competition/00B42B34-228F-F111-B337-6045BD14DEDF
  adr: null
  pr: null
files:
 - apps/ai-service/app/adapters/signals.py
 - apps/ai-service/app/agents/models.py
 - apps/ai-service/app/agents/prediction_agent.py
 - apps/ai-service/app/callbacks/predictions.py
 - apps/ai-service/app/config.py
 - apps/ai-service/scripts/seed_disruption.py
 - apps/ai-service/tests/test_prediction_agent.py
 - apps/ai-service/tests/test_predictions_callback.py
 - apps/api/prisma/schema.prisma
 - apps/api/prisma/migrations/20260815071818_user_story_2_alerts/migration.sql
 - apps/api/src/action/action.mapper.ts
 - apps/api/src/action/alert-formatter.service.ts
 - apps/api/src/action/alert.service.ts
 - apps/api/src/action/alert-escalation.service.ts
 - apps/api/src/action/predictions.controller.ts
 - apps/api/src/action/alerts.controller.ts
 - apps/api/src/action/action.module.ts
 - apps/api/src/internal/dto/create-prediction.dto.ts
 - apps/api/src/internal/predictions-callback.controller.ts
 - apps/api/src/internal/internal.module.ts
 - apps/api/src/notification/alert-notifier.service.ts
 - apps/api/src/notification/notification.module.ts
 - apps/api/src/app.module.ts
 - apps/web/lib/api.ts
 - apps/web/app/alerts/page.tsx
 - apps/web/app/alerts/[id]/page.tsx
 - apps/web/app/alerts/history/page.tsx
 - apps/api/test/helpers/test-app.ts
 - apps/api/test/contract/predictions.spec.ts
 - apps/api/test/contract/alerts.spec.ts
 - apps/api/test/integration/disruption-alert.spec.ts
 - apps/api/test/integration/prediction-history.spec.ts
 - specs/001-supply-chain-digital-twin/tasks.md
tests:
 - apps/ai-service/tests/test_prediction_agent.py (pytest, 6 passed)
 - apps/ai-service/tests/test_predictions_callback.py (pytest, 2 passed)
 - apps/api/test/contract/predictions.spec.ts (Jest, 4 passed)
 - apps/api/test/contract/alerts.spec.ts (Jest, 4 passed)
 - apps/api/test/integration/disruption-alert.spec.ts (Jest, 4 passed)
 - apps/api/test/integration/prediction-history.spec.ts (Jest, 3 passed)
 - manual cross-process smoke test — real ai-service Prediction Agent (stub Claude) → real HTTP → live apps/api → verified via public GET /alerts
---

## Prompt

(Continuation of the /sp.implement session; user said "continue karoooo" to
proceed from Phase 3 into Phase 4 — User Story 2, the predictive alerting
loop involving apps/ai-service and the Claude API for the first time.)

## Response snapshot

Built the full Prediction → Alert pipeline across both services. On `apps/ai-service`: mock signal adapters (`supplier_delay_signal`, `port_congestion_signal`, `demand_spike_signal`, T044); a `PredictionAgent` (T045) that enforces the ≥48h lead-time floor deterministically in code (not left to the LLM) and calls Claude only for a confidence estimate + plain-language rationale, with a `PredictionCallbackClient` (T046) posting the result to `apps/api`. On `apps/api`: `DisruptionPrediction`/`Alert` Prisma models with RLS extending T009's pattern (T042-T043); an `AlertService` computing severity from confidence score (T047); a template-based `AlertFormatterService` for jargon-free title/summary (T048, deliberately not a second Claude call); public `GET /predictions`/`GET /alerts` endpoints (T049); an `AlertNotifierService` publishing over SSE plus a logged-mock direct channel (T050); and a cron-based `AlertEscalationService` (T051). Built the alert inbox, detail, and history pages in `apps/web` (T052-T053) — the detail page honestly shows "no recommendation yet" rather than fabricating one, since Recommendation is a US3 entity that doesn't exist yet.

mypy strict caught a real typing issue: an initial `ClaudeMessageResponse` Protocol I wrote to type the Claude SDK response didn't actually structurally match `anthropic.types.Message` (list is invariant in Python, so a Protocol matching a union member doesn't satisfy `list[union]`) — fixed by making that one exact SDK boundary explicitly `Any`-typed with a comment explaining why, rather than pretending a broken Protocol type-checked.

The most valuable check this phase was a manual cross-process test that went beyond Jest: ran `apps/ai-service`'s actual `PredictionAgent` (stub Claude client only, everything else real) against a live `apps/api` dev server over real HTTP. First attempt used non-RFC4122-compliant placeholder UUIDs and got a `400` (correct, not a bug). Second attempt used a real-but-nonexistent supplier id and got a raw `500` — a genuine gap: a stale/invalid `affected_supplier_id` from the AI service (a real failure mode, since signal generation and the callback aren't atomic with the twin's state) leaked a Prisma FK-violation stack trace instead of a clean error. Fixed with explicit `P2003` error-code handling → `422`, plus a regression test. Writing that regression test then surfaced a second, more consequential gap: the test's `res.body.error.message` was `undefined` even though the status code was right — `createTestApp()`'s test harness never registered `AllExceptionsFilter` the way `main.ts`'s real bootstrap does, so every prior test's error-path assertions had been running against a different, un-wrapped exception shape than what actually ships. Fixed at the harness level, which silently strengthened every other test in the suite that touches an error response.

## Outcome

- ✅ Impact: User Story 2 (P2 — early disruption warning) is complete and demoable end to end, including a genuine cross-service Claude-agent-driven pipeline, not just isolated unit coverage.
- 🧪 Tests: 8 new pytest tests (ai-service) + 15 new Jest tests (api) all passing; full suites now 9/9 (ai-service) and 45/45 across 19 suites (api); one real cross-process manual verification (stub Claude, real HTTP, real Postgres).
- 📁 Files: ~33 new/modified files across both services plus 3 new frontend pages; `tasks.md` updated.
- 🔁 Next prompts: Awaiting user confirmation to proceed to Phase 5 (User Story 3 — act on a recommended contingency plan, T054–T072), which adds the Sourcing Recommendation and Contingency Plan agents and closes the "predict → recommend → act" loop.
- 🧠 Reflection: The test-harness gap (missing `AllExceptionsFilter` in `createTestApp()`) is the kind of thing that's invisible until a test happens to assert on error-response *shape* rather than just status code — worth deliberately writing at least one such shape-asserting test per new error path going forward, specifically because it's the class of bug that stays hidden otherwise.

## Evaluation notes (flywheel)

- Failure modes observed: (1) a Python Protocol type that looked right but didn't structurally satisfy the real SDK type due to list invariance — mypy strict caught it; (2) non-RFC4122 UUIDs in my own manual test fixtures (self-induced, not a product bug); (3) an unhandled Prisma FK violation leaking as a raw `500` across a real service boundary; (4) a test harness silently diverging from production's exception-handling bootstrap, undetected until a shape-asserting test was written.
- Graders run and results (PASS/FAIL): `mypy`/`ruff` (ai-service) — PASS; `tsc`/`eslint`/`nest build` (api) — PASS; `tsc`/`eslint`/`next build` (web) — PASS; pytest — 9/9 PASS; Jest — 45/45 PASS across 19 suites; manual cross-process test — PASS after two real fixes.
- Prompt variant (if applicable): N/A
- Next experiment (smallest change to try): When adding a new internal/external-service-boundary endpoint, write the "hostile input from a real but stale/misbehaving caller" test *before* the happy-path test — that ordering would have caught the FK-violation gap without needing a manual cross-process run first.
