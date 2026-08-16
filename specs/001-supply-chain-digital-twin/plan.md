# Implementation Plan: Supply Chain Digital Twin

**Branch**: `001-supply-chain-digital-twin` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-supply-chain-digital-twin/spec.md`

## Summary

Build a multi-tenant SaaS that gives a UAE SME owner a live digital twin of
their supply chain (inventory, orders, suppliers, logistics), an AI
prediction layer that flags disruptions ≥48 hours before impact, and an
action layer that recommends — and, opt-in, can auto-trigger — alternative
local sourcing, presented as a plain-language alert with a step-by-step
contingency plan. Technical approach: Next.js frontend + a NestJS
"platform" service (ingestion, twin read-model, action/notification,
identity) + a separate FastAPI "AI service" hosting three explicit agents
(Prediction, Sourcing Recommendation, Contingency Plan) calling an
OpenAI-compatible LLM provider (Groq by default — see research.md §2's
amendment), backed by PostgreSQL (row-level tenant isolation) and Redis
(twin cache, SSE fan-out, job queue), deployed on Vercel (frontend) +
Railway (platform service, AI service, Postgres, Redis).

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14+, NestJS 10+) for the
frontend and platform service; Python 3.11+ for the AI service.
**Primary Dependencies**: Next.js, Tailwind CSS, shadcn/ui; NestJS,
Prisma (or TypeORM) for Postgres access; FastAPI, httpx (OpenAI-compatible
LLM client), Pydantic;
`ioredis` / `redis-py` for Redis.
**Storage**: PostgreSQL 15+ (system of record, row-level tenant isolation)
+ Redis 7+ (twin snapshot cache, pub/sub for SSE, ingestion/agent job
queue).
**Testing**: Jest + Supertest (NestJS contract/integration tests),
Playwright or React Testing Library (Next.js component/E2E tests), pytest
(FastAPI AI service unit tests).
**Target Platform**: Web (desktop + mobile browser), server-side on
Vercel (frontend) and Railway (platform + AI services, Postgres, Redis).
**Project Type**: Web application (frontend + backend, plus a dedicated AI
service — see Project Structure).
**Performance Goals**: Alert delivered to the owner within minutes of
generation (SC-003); twin view reflects underlying data changes without
manual refresh (User Story 1); system supports 150 concurrently active
pilot tenants scaling to 40,000+ without user-facing behavior change
(FR-010).
**Constraints**: 100% digital onboarding/integration (challenge must-have);
UAE-only logistics scope for MVP (Out of Scope); disruption predictions
MUST carry ≥48h lead time by construction (FR-003, SC-001); every
AI-generated prediction/recommendation and every auto-triggered action
MUST produce an audit log entry (Principle IV; explicit user requirement).
**Scale/Scope**: 150 pilot tenants at launch, architected for 40,000+
tenants; 3 user stories (twin view, early-warning alert, actionable
contingency plan); 3 AI agents; ~13 data entities (see data-model.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Spec-Driven Development Only | ✅ PASS | This plan follows an approved spec (`spec.md`, all `NEEDS CLARIFICATION` resolved); `/sp.tasks` and `/sp.implement` come after. |
| II | API-First, Modular Architecture | ⚠️ PARTIAL — justified | `contracts/api.yaml` is the versioned contract UI/integrations consume. The prediction layer is a genuinely separate deployable+datastore boundary (research.md §1). Ingestion/Twin/Action/Notification/Identity are separated as distinct NestJS modules with enforced internal boundaries but share one deployable and one Postgres instance rather than being five independently deployed services with five datastores. See Complexity Tracking. |
| III | Built for Rapid Scale (40,000+) | ✅ PASS | Stateless services, Postgres RLS multi-tenancy, Redis-backed shared cache/queue (research.md §5) — same architecture at 150 and 40,000 tenants. |
| IV | AI Agents as First-Class Citizens | ✅ PASS | 3 explicit agents (Prediction, Sourcing Recommendation, Contingency Plan) with inspectable inputs/outputs; every agent action writes an `AuditLogEntry` (data-model.md). |
| V | Privacy-First & Consent-Bound Data | ✅ PASS — flow enumerated and gated | The AI service sends tenant supply-chain signals to a third-party LLM provider (Groq by default; provider-agnostic per research.md §2). Mitigated by: `Tenant.ai_processing_consent_at`, enforced as a hard `403` on both AI callbacks and as the only path to `active` onboarding status (T078 — this was **claimed but unimplemented** until Phase 6's security review caught it; now covered by `ai-consent-gate.spec.ts`); minimization (only signal data needed for prediction, not full raw records); and every call logged via `AuditLogEntry`. No other third-party data egress exists in this design. |
| VI | Radically Simple UX | ✅ PASS | Alerts/contingency plans specified as plain-language (FR-004, FR-007); onboarding is self-service (FR-009). |
| VII | Pilot-Ready by Design (150+) | ✅ PASS | FR-009/FR-010, SC-004 target the pilot directly; `quickstart.md` walks the full onboarding→alert→decision loop. |
| VIII | Lightweight, Fast-to-Deploy Stack | ✅ PASS | SSE over WebSockets, managed Railway/Vercel infra, custom lightweight agent orchestration instead of LangGraph/CrewAI (research.md §2–§4) — each choice justified by what it avoids building/operating. |
| IX | Layered Separation: Ingestion/Prediction/Action | ⚠️ PARTIAL — justified | Prediction is a hard, physical boundary (separate FastAPI service/datastore access). Ingestion/Action/Notification separation within the NestJS platform service is enforced by module boundaries (DI, no cross-module repository imports), not physical deployment. See Complexity Tracking. |
| X | Production-Grade Code Quality | ✅ PASS | TypeScript strict mode + Python type hints/Pydantic; contract, integration, and unit tests specified in `quickstart.md`. |
| — | Challenge must-have: rapid scalability | ✅ PASS | See Principle III. |
| — | Challenge must-have: 100% digital integration | ✅ PASS | No manual/offline step in the core loop; CSV/manual entry is still 100% digital (FR-001). |
| — | Challenge must-have: scale to 40,000+ SMEs | ✅ PASS | See Principle III. |

Two ⚠️ items are carried into Complexity Tracking below with explicit
justification, as the constitution requires, rather than silently accepted
or used to block the plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-supply-chain-digital-twin/
├── plan.md              # This file (/sp.plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── api.yaml           # Phase 1 output (OpenAPI 3.0)
└── tasks.md              # Phase 2 output (/sp.tasks — not created by /sp.plan)
```

### Source Code (repository root)

```text
apps/
├── web/                          # Next.js + TypeScript + Tailwind + shadcn/ui
│   ├── app/                       # onboarding, twin view, alerts, contingency plan UI
│   ├── components/
│   └── lib/                       # API client, SSE client
│
├── api/                          # NestJS "platform" service
│   ├── src/
│   │   ├── identity/               # auth, User, RBAC (owner/staff/platform_admin)
│   │   ├── ingestion/              # DataSource, CSV upload, InventoryItem/Supplier/Order/LogisticsEvent
│   │   ├── twin/                   # Digital Twin read-model (Redis-cached aggregation)
│   │   ├── action/                 # Alert, Recommendation, AutoTriggerRule, decision recording
│   │   ├── notification/           # SSE stream, alert delivery channels
│   │   └── audit/                  # AuditLogEntry (append-only)
│   └── test/
│       ├── contract/                # one test per contracts/api.yaml operation
│       └── integration/             # ingestion → twin → alert → decision flow; RLS isolation test
│
└── ai-service/                   # FastAPI "AI" service (Principle IX hard boundary)
    ├── app/
    │   ├── agents/
    │   │   ├── prediction_agent.py
    │   │   ├── sourcing_recommendation_agent.py
    │   │   └── contingency_plan_agent.py
    │   └── adapters/                # mock supplier/logistics signal adapters (research.md §7)
    └── tests/
```

**Structure Decision**: Web application split into three deployables per
`research.md` — `apps/web` (Next.js), `apps/api` (NestJS platform
service covering identity/ingestion/twin/action/notification/audit as
internally-separated modules), and `apps/ai-service` (FastAPI, the one
genuinely independent prediction-layer deployable). This is a **modular
monolith for the platform service** plus **one hard microservice boundary**
at prediction — the deliberate trade-off recorded in Complexity Tracking.

## Complexity Tracking

> Justifying the two ⚠️ Constitution Check items above.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Ingestion, Twin, Action, Notification, and Identity share one NestJS deployable and one Postgres instance, instead of five independently deployed services each with its own datastore (Principle II's literal reading). | A ~9-week hackathon-to-pilot timeline (constitution §VIII) cannot absorb the operational cost of standing up, securing, and coordinating five separately deployed services for a 150-tenant pilot; the modular-monolith still gives each area its own NestJS module with enforced boundaries (no cross-module repository access), independent unit/contract testability, and a clear extraction seam if a module later needs to scale or fail independently. | Five fully independent services+datastores: rejected because at 150–40,000 tenants (not 150M), the added latency, deployment coordination, and cross-service transaction complexity outweigh the isolation benefit, and it directly conflicts with Principle VIII's requirement that new services be justified by what they remove — here they would only add. |
| Data leaves the system boundary to the Claude API for prediction/recommendation generation (Principle V flags any third-party AI egress). | The product's entire value proposition — AI-predicted disruptions and AI-generated contingency plans — requires an LLM; building/hosting an equivalent in-house model is out of reach for a hackathon/pilot timeline and would fail Principle VIII (lightweight stack) far more severely than a well-consented API call. | Self-hosted/open-source model: rejected for MVP — materially higher build and inference-hosting cost for a 150-tenant pilot, with no clear pilot-stage benefit over a consented, minimized, audited call to a managed LLM API; revisit only if consent/data-residency requirements change post-pilot. |
