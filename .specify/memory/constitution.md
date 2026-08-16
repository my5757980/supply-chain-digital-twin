<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Rationale: Initial ratification of the project constitution (MAJOR — establishes
  governance and all founding principles for the first time; no prior version existed).
- Modified principles: n/a (initial creation)
- Added sections:
  - Core Principles I–X (Spec-Driven Development Only; API-First & Modular
    Architecture; Built for Rapid Scale; AI Agents as First-Class Citizens;
    Privacy-First & Consent-Bound Data; Radically Simple UX; Pilot-Ready by
    Design; Lightweight & Fast-to-Deploy Stack; Layered Separation of
    Ingestion/Prediction/Action; Production-Grade Code Quality)
  - Challenge & Track Alignment (du SME Resilience & Innovation Challenge —
    Track 1: ResilienceTech / AI-Driven Supply Chain Digital Twins)
  - Development Workflow & Quality Gates
  - Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate is
    generic and reads from this file at plan time; no edits required.
  - ✅ .specify/templates/spec-template.md — generic, no constitution-specific
    references to reconcile.
  - ✅ .specify/templates/tasks-template.md — generic, no constitution-specific
    references to reconcile.
  - ✅ .claude/commands/sp.*.md — no outdated principle references found.
- Follow-up TODOs:
  - TODO(PRIZE_DETAILS): Challenge page states "Details in description" for
    rewards; no fixed prize amount was published at ratification time.
-->

# Supply Chain Digital Twin (du SME Resilience Challenge) Constitution

## Core Principles

### I. Spec-Driven Development Only (NON-NEGOTIABLE)
No code is written before a spec exists and is approved. Every feature MUST
pass through `/sp.specify` → `/sp.plan` → `/sp.tasks` → `/sp.implement` in
order; skipping a stage requires explicit user consent recorded in a PHR.
Every user prompt MUST produce a Prompt History Record and every
architecturally significant decision MUST be offered as an ADR before
implementation proceeds.
**Rationale**: The challenge timeline (Aug 3 – Oct 9, 2026) and a pilot
across 150+ du SME partners leave no room for rework caused by
undocumented, ad-hoc decisions; spec-first is the cheapest way to keep the
team and judges aligned on scope.

### II. API-First, Modular Architecture
Every capability MUST be exposed through a versioned API contract before any
UI or integration consumes it. Modules (ingestion, prediction, action,
notification, identity) MUST be independently deployable and MUST NOT share
internal data stores. Direct database access across module boundaries is
FORBIDDEN.
**Rationale**: The challenge's "Composable Micro-ERPs" framing and the
"100% digital integration capability" must-have both require that partner
systems (ERPs, customs, banking, logistics) can integrate without touching
internals.

### III. Built for Rapid Scale (40,000+ SMEs)
Every design decision MUST state how it behaves at 150 pilot tenants and at
40,000+ tenants; features that only work at pilot scale MUST be flagged as
`NEEDS CLARIFICATION: scale` during `/sp.plan`. Multi-tenancy, horizontal
scaling, and stateless services are the default; single-tenant or
stateful-singleton designs require an ADR justifying the exception.
**Rationale**: This is an explicit, non-negotiable "Must-Have" of the du
challenge ("Scalable to support du's growing base of 40,000+ SME
customers").

### IV. AI Agents as First-Class Citizens
Prediction (disruption/delay forecasting), recommendation (alternative
sourcing, contingency plans), and action (triggering sourcing changes,
alerts) MUST each be implemented as an explicit, observable AI agent or
model component — not buried as inline heuristics. Every agent MUST expose
its inputs, confidence/output, and the action it proposed or took, so a
human can audit or override it.
**Rationale**: The challenge explicitly asks for solutions that "predict
disruptions," "automatically recommend or trigger alternative local
sourcing," and "generate step-by-step contingency plans" — AI is the
product, not an add-on.

### V. Privacy-First & Consent-Bound Data
SME operational data (inventory, suppliers, financials, shipments) MUST
stay within the platform's controlled boundary. Data MUST NOT leave the
system (including to third-party AI providers, analytics, or partner
integrations) without explicit, logged SME consent scoped to a stated
purpose. All cross-boundary data flows MUST be enumerated in the plan's
Constitution Check.
**Rationale**: SMEs are trusting a third-party platform with commercially
sensitive supply chain and financial data; consent-bound handling is a
condition of both regulatory compliance and du/SME trust, and is called out
explicitly by the user's founding principles.

### VI. Radically Simple UX for Non-Technical Owners
Every user-facing surface MUST be usable by an SME owner with no technical
background, in the owner's working language, within a self-explanatory flow
(no jargon such as "API," "webhook," "SKU mapping" in the primary UI).
Every feature spec MUST include a plain-language walkthrough as part of its
User Scenarios, independent of the technical implementation.
**Rationale**: The pilot audience is SME owners/operators, not IT staff;
adoption at 40,000+ scale fails if the product requires technical
onboarding.

### VII. Pilot-Ready by Design (150+ du SME Partners)
Every feature MUST define how it will be validated in a live pilot with
150+ du SME partners: onboarding path, success metrics, and rollback plan.
Success criteria for the Track 1 submission MUST include a measurable
operational metric aligned to the challenge's example KPI (e.g., "≥40%
faster business pivot / disruption response speed").
**Rationale**: The challenge's "What We Need From You" explicitly requires
a Pilot Strategy against 150+ du SME partners and measurable Success
Metrics; features that can't be piloted can't be submitted.

### VIII. Lightweight, Modern, Fast-to-Deploy Stack
Technology choices MUST favor managed services, well-supported frameworks,
and minimal operational overhead over bespoke infrastructure. A new
dependency or service MUST be justified in `/sp.plan` by what it removes
(time, ops burden, code) — "because it's more powerful" is not sufficient
justification.
**Rationale**: The team is delivering against a ~9-week hackathon-to-pilot
window; heavyweight infrastructure choices are the most common way such
timelines are lost.

### IX. Layered Separation: Ingestion / Prediction / Action
The system MUST maintain a clear, enforced boundary between three layers:
(1) real-time data ingestion (supplier feeds, inventory, logistics events),
(2) the AI prediction/recommendation engine, and (3) the action layer that
executes or proposes interventions (alerts, sourcing changes, contingency
plans). Each layer MUST be independently testable and independently
deployable; the action layer MUST NOT call ingestion sources directly, and
MUST only act on prediction-layer outputs.
**Rationale**: This separation is an explicit founding principle and is
also what makes the "Automated Scenario Planning" and "Digital Twin"
components independently verifiable and safe to automate.

### X. Production-Grade Code Quality
All code MUST be typed (static typing enabled and enforced in CI), covered
by tests appropriate to its risk (contract tests for APIs, integration
tests for cross-module flows), and documented at the public-interface level
(what it does, its contract, not implementation narration). Untyped,
untested "prototype" code MUST NOT reach the pilot integration branch.
**Rationale**: A pilot with real SME data and 150+ live partners is
production, not a demo; the challenge's own must-have of rapid scalability
depends on a codebase that doesn't accumulate untested shortcuts.

## Challenge & Track Alignment

This project is built for the **du SME Resilience & Innovation Challenge**
(host: du; platform: Ignyte; window: 2026-08-03 to 2026-10-09), and commits
to **Track 1 — Theme 1: ResilienceTech**, specifically the **AI-Driven
Supply Chain Digital Twins** track, with adjacent alignment to that theme's
sibling tracks (Composable Micro-ERPs, Automated Scenario Planning) where
they reduce duplicate work.

Non-negotiable challenge must-haves (binding on every spec and plan):
- MUST be built for rapid scalability supporting du's mission of helping
  local businesses.
- MUST provide 100% digital integration capability (no manual/offline
  steps in the core product loop).
- MUST be architected to scale to du's base of 40,000+ SME customers over
  time, validated first against a pilot of 150+ du SME partners.

Every feature submission-relevant spec MUST be able to answer, in its
Success Criteria section:
- **Concept Summary**: what the solution is and that it addresses the
  Resilience track (AI-Driven Supply Chain Digital Twin).
- **Integration Plan**: how it integrates with existing SME/du
  infrastructure (API-first, per Principle II).
- **Pilot Strategy**: how it validates with 150+ du SME partners (Principle
  VII).
- **Success Metrics**: measurable KPIs (e.g., faster disruption response /
  business pivot speed).
- **Risk Mitigation**: deployment, operational, and regulatory risks and
  their mitigations (informed by Principle V for data risk).

TODO(PRIZE_DETAILS): the challenge listing states prize details are "in
description" without a published figure at ratification time; do not
reference a specific prize amount in submission artifacts until confirmed.

## Development Workflow & Quality Gates

- Flow: `/sp.constitution` (this file) → `/sp.specify` → `/sp.clarify` (if
  ambiguity remains) → `/sp.plan` → `/sp.tasks` → `/sp.implement`, with
  `/sp.analyze` run before implementation on any multi-story feature.
- Every `/sp.plan` MUST include a Constitution Check gate that explicitly
  tests the plan against Principles I–X and the Challenge Must-Haves above;
  violations MUST be recorded in that plan's Complexity Tracking table with
  a stated justification, or the plan MUST be revised.
- Every user prompt MUST result in a PHR under `history/prompts/`, routed
  per the rules in `CLAUDE.md` (constitution / `<feature-name>` / general).
- Every architecturally significant decision (long-term impact + real
  alternatives considered + cross-cutting scope) MUST be offered to the
  user as an ADR suggestion; ADRs are created only with explicit user
  consent, never automatically.
- Pull requests / merges MUST verify: typed code, tests for new
  API/contract surfaces, no cross-layer boundary violations (Principle IX),
  and no undeclared data egress (Principle V).

## Governance

This constitution supersedes all other project conventions, prior
practices, and ad-hoc agreements. Where a command file, template, or prior
decision conflicts with this document, this document wins until formally
amended.

**Amendment procedure**: Anyone (user or agent) may propose an amendment by
editing this file and stating the change, its rationale, and its version
bump classification. Amendments take effect only with explicit user
consent — an agent MUST NOT self-ratify a constitution change.

**Versioning policy** (semantic versioning applied to governance):
- MAJOR: backward-incompatible removal or redefinition of a principle, or
  a change to the ratified Track/Challenge commitment.
- MINOR: a new principle or section added, or materially expanded guidance
  on an existing principle.
- PATCH: wording clarifications, typo fixes, non-semantic refinements.

**Compliance review**: Every `/sp.plan` Constitution Check gate and every
`/sp.analyze` run is a live compliance review against this document. Any
detected drift between this constitution and `.specify/templates/*.md` or
`.claude/commands/*.md` MUST be logged as a follow-up TODO in the next
Sync Impact Report and resolved before the next feature's plan is approved.

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
