# Phase 0 Research: Supply Chain Digital Twin

**Feature**: `001-supply-chain-digital-twin` | **Date**: 2026-08-14

Purpose: resolve every open technology choice in the user-supplied tech
preferences (which included several "or" options) into a single decision
each, so `plan.md` Technical Context has no `NEEDS CLARIFICATION` markers.

---

## 1. Backend framework: NestJS vs. FastAPI

**Decision**: Split by layer — **NestJS (TypeScript)** for the Ingestion,
Twin, Action/Notification, and Identity modules; a small standalone
**FastAPI (Python)** service for the AI Prediction/Recommendation layer.

**Rationale**: The constitution's Principle IX requires an enforced
boundary between ingestion, prediction, and action layers, with the action
layer only consuming prediction outputs — never calling ingestion directly.
Splitting the stack at exactly that seam turns a *policy* requirement into
a *physical* one: the AI service literally cannot reach ingestion internals
because it's a separate deployable with its own API. NestJS gives the
ingestion/twin/action layer strong typing, built-in modular DI (maps
directly to Principle II's module boundaries), and shares a language with
the Next.js frontend, minimizing context-switching for a small hackathon
team. Python/FastAPI is kept only where it earns its keep: LLM/agent
tooling (Anthropic SDK, pandas/numpy for signal processing over ingested
time series) is materially better in Python than in Node.

**Alternatives considered**:
- *All-NestJS, LLM calls inline*: rejected — collapses the prediction/action
  boundary the constitution requires, and Node's data-science/LLM-agent
  ecosystem is thinner.
- *All-FastAPI*: rejected — loses TypeScript type-sharing with the Next.js
  frontend for the higher-traffic CRUD/API surface, and Python DI/module
  conventions are looser than Nest's, working against Principle II.

## 2. AI provider & agent framework

> **Amended 2026-08-16** — the provider decision below changed during
> implementation. See "Amendment: provider abstraction" at the end of this
> section. The agent-framework decision (custom module, not LangGraph or
> CrewAI) still stands and was not revisited.

**Original decision**: **Anthropic Claude API** (Claude Sonnet for
reasoning/plan generation, Claude Haiku for cheap high-volume
classification where applicable) called directly via the official SDK,
orchestrated by a small **custom agent module** (not LangGraph/CrewAI) with
three explicit agents: Prediction Agent, Sourcing Recommendation Agent,
Contingency Plan Agent.

**Rationale**: Constitution Principle VIII requires justifying new
dependencies by what they remove. A full agent framework (LangGraph/CrewAI)
buys graph-based orchestration and persistence primitives this feature
doesn't need yet — three agents with a fixed, sequential/event-driven
pipeline (ingested signal → prediction → recommendation → contingency plan)
don't require a graph orchestrator. A ~200-line custom orchestrator keeps
the dependency surface small and every agent's inputs/outputs directly
inspectable and loggable, which is what Principle IV (auditable AI) and the
user's explicit "audit logs for every AI recommendation" requirement need.
If agent complexity grows post-pilot (parallel/conditional agent graphs),
LangGraph can be adopted then — documented here as the first thing to
revisit if the custom orchestrator strains.

**Alternatives considered**:
- *OpenAI API*: viable equally, but Claude is chosen as the primary/default
  model family for this project's tooling and reasoning-heavy tasks
  (disruption analysis, contingency plan drafting benefit from longer,
  structured reasoning).
- *LangGraph*: rejected for MVP (see rationale) — revisit if agent
  topology becomes conditional/parallel rather than a fixed pipeline.
- *CrewAI*: rejected — heavier abstraction (roles/crews) than three fixed
  agents justify at pilot scale.

### Amendment: provider abstraction (2026-08-16)

**What changed**: the vendor SDK was replaced with a thin
OpenAI-compatible HTTP client (`app/agents/llm_client.py`). The default
provider is now **Groq** (`llama-3.3-70b-versatile`), configured via
`LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`.

**Why**: the original decision named one vendor, and the pilot team could
not obtain usable Anthropic credits — the challenge provides no API or
cloud credits to participants (verified against the challenge listing:
neither the Overview, Rules, nor Official Updates mention any). Binding
the agents to one vendor's SDK made that a code problem instead of a
config problem, which was the actual defect.

**What this buys**: the provider is now a deployment decision. Any
OpenAI-compatible endpoint works — Groq, OpenAI, OpenRouter, xAI, or a
self-hosted model — by changing three environment variables. Nothing about
the agent design, the ≥48h floor, FR-006's sourcing policy, or the audit
trail depends on which model answers.

**What it costs**: prompts are no longer tuned to one model family, and
smaller/open models format JSON less reliably. `parse_json_reply` was
hardened to tolerate markdown fences and surrounding prose, with a
regression test for each — that is the real price of provider
independence, and it is cheap.

**Unchanged**: Constitution Principle V still treats the LLM provider as a
third-party egress point. The consent gate (`Tenant.ai_processing_consent_at`)
is provider-agnostic and applies identically.

## 3. Real-time channel: WebSockets vs. Server-Sent Events

**Decision**: **Server-Sent Events (SSE)** for pushing twin updates and new
alerts to the SME owner's browser; standard REST for all client→server
actions (decisions, onboarding, data entry).

**Rationale**: Every real-time need in this feature is one-directional
(server → client: "twin changed," "new alert," "alert escalated"). SSE
gives that over plain HTTP — no separate socket protocol/infra, works
cleanly through standard HTTP load balancers and Vercel/Railway's
request-based routing, and is materially simpler to scale and operate
(Principle VIII: lightweight, minimal ops). WebSockets would be justified
if the client needed to push frequent low-latency events back (e.g., live
cursors, chat) — this product has no such requirement.

**Alternatives considered**:
- *WebSockets*: rejected for MVP — bidirectional capability isn't needed,
  and it adds connection-state management the team doesn't need to own at
  pilot scale.
- *Polling*: rejected — wastes requests at 40,000-SME scale and adds
  perceptible alert latency, working against SC-003 (act within 5 minutes).

## 4. Deployment targets

**Decision**: **Vercel** for the Next.js frontend; **Railway** for the
NestJS API, the FastAPI AI service, managed PostgreSQL, and managed Redis
(one project, four services).

**Rationale**: Railway hosts multiple services plus managed Postgres/Redis
under one project with minimal ops configuration, which keeps the "4
must-be-independently-deployable modules" (Principle II/IX) each as a
distinct Railway service without needing four separate vendor accounts.
Vercel remains the best fit for Next.js specifically (its own framework,
zero-config previews per PR — useful for judge/demo links). Render was
considered but Railway's multi-service-in-one-project model is a better
fit for this module count without extra orchestration.

**Alternatives considered**:
- *Render for everything*: workable but Railway's project-level service
  grouping and simpler managed Postgres/Redis provisioning is faster to
  set up under hackathon time pressure.
- *Single VM/Docker Compose self-host*: rejected — reintroduces the ops
  burden Principle VIII explicitly says to avoid.

## 5. Database strategy

**Decision**: **PostgreSQL** as the system of record with **row-level
tenant isolation** (every table carries `tenant_id`; Postgres Row-Level
Security policies enforce that a request can only read/write its own
tenant's rows) instead of database-per-tenant. **Redis** used for (a) the
pub/sub fan-out that feeds SSE connections, (b) caching each tenant's
current Digital Twin snapshot for fast reads, and (c) a lightweight job
queue for ingestion processing (CSV parsing, agent invocation).

**Rationale**: Row-level isolation with RLS scales to 40,000+ tenants
without the operational overhead of provisioning/migrating 40,000 separate
databases (Principle III + VIII). RLS makes tenant isolation a
database-enforced guarantee, not just an application-layer discipline —
directly satisfying FR-011 and SC-006 (zero cross-tenant exposure) even if
an application bug forgets a `WHERE tenant_id = ...` clause.

**Alternatives considered**:
- *Database-per-tenant*: rejected — 150 databases is manageable, 40,000 is
  not, and the spec requires the same architecture to work at both scales
  without user-facing change (FR-010).
- *Application-layer-only isolation (no RLS)*: rejected — a single missed
  filter becomes a cross-tenant data leak; RLS is the standard mitigation
  and costs little to add in Postgres.

## 6. Authentication & RBAC

**Decision**: Session-based auth via a managed auth provider (e.g.,
Auth.js/Clerk-style — exact vendor is an implementation detail, not
re-litigated here) with three roles: **Owner** (full control, incl.
auto-trigger rule configuration), **Staff** (view twin/alerts, record
decisions, cannot change auto-trigger rules or billing), and **Platform
Admin** (du/pilot-ops role, cross-tenant support access, fully audit-logged,
used only for onboarding assistance during the pilot).

**Rationale**: The spec only names "SME owner," but the plan's explicit
architecture requirement calls for SME owner + staff roles, and a pilot
supporting 150 SMEs realistically needs an internal support/admin role.
This is a plan-level elaboration of access control, not a new user-facing
capability, so it doesn't require a spec amendment — it's flagged here for
traceability. Standard session-based auth is the constitution-approved
default (no NEEDS CLARIFICATION per spec-template's own guidance on
reasonable defaults).

**Alternatives considered**:
- *Owner-only (no staff/admin roles)*: rejected — doesn't meet the user's
  explicit plan-level RBAC requirement.
- *Full custom RBAC engine*: rejected as premature — three fixed roles
  cover the MVP; a rules-based permission engine is a post-pilot concern.

## 7. External supplier/logistics data for MVP

**Decision**: Mock/simulated adapters for supplier and logistics signals
(port congestion feeds, carrier ETA feeds) behind the same interface a real
integration would use, seeded with realistic UAE-relevant scenarios for
demo/pilot purposes; the Local Supplier Directory (FR-006 fallback) is a
seeded, platform-maintained dataset, not a live third-party integration.

**Rationale**: Explicitly requested by the user ("mock for MVP") and
consistent with Out of Scope (no complex multi-country logistics
integration). Building the adapter interface for real feeds now (Principle
II: API-first) means swapping mocks for live data post-pilot doesn't
require redesigning the ingestion layer.

**Alternatives considered**: Live third-party logistics API integration —
rejected for MVP; explicit user instruction and unnecessary scope for a
150-SME pilot validating the prediction/recommendation loop.

---

**Status**: All Technical Context unknowns resolved. No `NEEDS
CLARIFICATION` markers remain. Proceeding to Phase 1.
