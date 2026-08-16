# Feature Specification: Supply Chain Digital Twin

**Feature Branch**: `001-supply-chain-digital-twin`
**Created**: 2026-08-14
**Status**: Draft
**Input**: User description: "Build an AI-powered Supply Chain Digital Twin for SMEs participating in the du SME Resilience Challenge (Track 1 - ResilienceTech). Creates a live virtual replica of an SME's supply chain, continuously ingests real-time operational data (inventory, orders, supplier status, logistics), uses AI agents to predict disruptions (supplier delays, port congestion, demand spikes), automatically recommends or triggers alternative local sourcing before stockouts happen, and shows clear alerts plus step-by-step contingency plans to the SME owner. Target users: UAE-based SMEs, non-technical business owners. Must support easy onboarding for 150+ pilot SMEs, 100% digital integration, scalable to 40,000+ SMEs later. Key success metrics: predict disruptions at least 48 hours in advance, reduce stockout risk by 40%+, SME can act on recommendations within minutes. Out of scope for MVP: full ERP replacement, blockchain/payments, complex multi-country logistics."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a live view of the supply chain (Priority: P1)

An SME owner connects their business data and, for the first time, sees a
single live view of their supply chain: current inventory levels, open
orders, supplier status, and shipments in transit — replacing spreadsheets,
WhatsApp messages, and phone calls with one picture of "what's happening
right now."

**Why this priority**: Without a trustworthy live picture of the supply
chain, no prediction or recommendation downstream can be trusted or acted
on. This is the foundation every other story depends on, and on its own it
already replaces manual status-chasing — a real, demonstrable value.

**Independent Test**: Can be fully tested by onboarding a test SME with
sample inventory, order, supplier, and logistics data, and confirming the
digital twin view reflects that data accurately and updates when the
underlying data changes.

**Acceptance Scenarios**:

1. **Given** an SME owner has completed onboarding and connected their data
   sources, **When** they open the digital twin view, **Then** they see
   current inventory levels, open orders, supplier statuses, and in-transit
   shipments in one place.
2. **Given** the digital twin is showing a supplier's status, **When** that
   supplier's underlying data changes (e.g., a shipment status updates),
   **Then** the twin reflects the change without the owner having to
   manually refresh or re-enter anything.
3. **Given** a data source stops sending updates, **When** the owner views
   the affected part of the twin, **Then** the system clearly flags that
   the data is stale rather than silently showing outdated information as
   current.

---

### User Story 2 - Get an early warning before a disruption hits (Priority: P2)

An SME owner receives a plain-language alert that a disruption — a
supplier delay, port congestion, or a demand spike — is likely to affect
their business, with enough advance notice to do something about it before
it causes a stockout.

**Why this priority**: This is the predictive value the challenge asks
for, and the reason the product exists beyond a status dashboard. It is
independently testable and demonstrable once User Story 1's live twin
exists to predict from.

**Independent Test**: Can be fully tested by feeding the system a scenario
with a known upcoming disruption pattern (e.g., simulated supplier delay
data) and confirming an alert is generated at least 48 hours before the
simulated impact date, in plain language an SME owner can understand.

**Acceptance Scenarios**:

1. **Given** the digital twin detects a pattern consistent with a likely
   disruption (e.g., a supplier repeatedly missing lead times), **When**
   the prediction engine flags it, **Then** the SME owner receives an
   alert at least 48 hours before the predicted impact, stating what is at
   risk and by when.
2. **Given** an alert has been generated, **When** the owner opens it,
   **Then** they see the affected items/orders and the reasoning in plain
   business language (not technical or statistical jargon).
3. **Given** a predicted disruption does not end up happening, **When** the
   owner later reviews their alert history, **Then** the outcome is shown
   transparently (including false predictions) so the owner can gauge how
   much to trust future alerts.

---

### User Story 3 - Act on a recommended contingency plan (Priority: P3)

Once warned of a disruption, the SME owner sees a step-by-step contingency
plan — including alternative local sourcing options — and can accept,
adjust, or dismiss it, closing the loop from "we saw this coming" to "we
avoided the stockout."

**Why this priority**: This delivers the full end-to-end promise of the
product, but depends on Stories 1 and 2 already existing; it is the layer
that turns a warning into an outcome.

**Independent Test**: Can be fully tested by triggering a disruption alert
(as in Story 2) and confirming the owner is shown a step-by-step
contingency plan with at least one alternative sourcing option, can record
a decision (accept/modify/dismiss), and that decision is saved against the
alert.

**Acceptance Scenarios**:

1. **Given** an active disruption alert, **When** the owner opens it,
   **Then** they see a step-by-step contingency plan, including any
   recommended alternative sourcing option(s), written in plain language.
2. **Given** a contingency plan recommendation, **When** the owner accepts,
   modifies, or dismisses it, **Then** the system records that decision
   against the alert and reflects it in the alert's history.
3. **Given** a predicted disruption for which no viable alternative sourcing
   option exists, **When** the owner opens the alert, **Then** the system
   still shows the warning and offers general mitigation guidance rather
   than silently omitting the alert.

### Edge Cases

- What happens when a connected data source stops updating for an extended
  period? The affected part of the twin MUST be marked stale rather than
  treated as current.
- What happens when a predicted disruption has no viable alternative
  sourcing option? The owner MUST still receive the warning, with fallback
  guidance instead of a silent gap.
- What happens when multiple disruptions are predicted at the same time?
  Alerts MUST be ranked by severity/urgency so the owner is not overwhelmed
  by simultaneous notifications.
- What happens when an SME owner has not acted on a time-sensitive alert
  as the predicted impact window approaches? The system MUST escalate the
  alert (e.g., re-notify, raise priority) rather than let it silently
  expire.
- What happens when an SME onboards with only partial data (e.g., inventory
  but no supplier data)? The twin MUST still render with what is available
  and clearly indicate what's missing and how it limits prediction quality.
- What happens when a prediction turns out to be wrong (false positive)?
  It MUST be retained and shown in the alert history rather than hidden, to
  keep the system's track record transparent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an SME owner to onboard their business and
  connect their operational data (inventory, orders, supplier status,
  logistics) via manual entry or spreadsheet/CSV upload for the MVP pilot.
  The underlying architecture MUST be API-first so direct integrations
  with SMEs' existing tools (POS/ERP/e-commerce platforms) can be added
  post-pilot without redesigning the ingestion layer.
- **FR-002**: System MUST maintain a continuously updated digital twin
  reflecting the current state of an SME's inventory, open orders, supplier
  statuses, and in-transit logistics.
- **FR-003**: System MUST predict supply chain disruptions (e.g., supplier
  delays, port congestion, demand spikes) at least 48 hours before their
  predicted impact on the SME's operations.
- **FR-004**: System MUST generate a plain-language alert for each
  predicted disruption stating what is at risk and the expected time
  window of impact.
- **FR-005**: System MUST recommend alternative local sourcing options in
  response to a predicted disruption, before a stockout occurs. By
  default, recommendations require the owner's approval before any
  sourcing action is taken; the owner MAY opt in to automatic triggering
  for specific suppliers or rules they define, and every auto-triggered
  action MUST remain visible and reversible/auditable by the owner.
- **FR-006**: Alternative sourcing recommendations MUST first consider
  backup suppliers the SME has registered themselves; when the SME has no
  suitable registered backup, the system MUST fall back to a
  platform-curated directory of local (UAE) suppliers matched to the
  SME's needs.
- **FR-007**: System MUST present a step-by-step contingency plan alongside
  each disruption alert, written for a non-technical business owner.
- **FR-008**: SME owner MUST be able to accept, modify, or dismiss a
  recommended action, and the system MUST record that decision against the
  alert.
- **FR-009**: SME owner MUST be able to complete onboarding without
  requiring developer or IT assistance (self-service, guided setup).
- **FR-010**: System MUST support onboarding and active use by at least 150
  SMEs during the pilot, and MUST be architected so this scales to 40,000+
  SMEs without changes to user-facing behavior.
- **FR-011**: System MUST keep each SME's data isolated from every other
  SME and MUST NOT share one SME's data with another tenant, or with any
  third party, without that SME's explicit consent.
- **FR-012**: System MUST maintain a visible history of past predictions
  and their outcomes (including false positives) so the owner can see the
  system's track record over time.
- **FR-013**: System MUST detect when a connected data source has stopped
  sending updates and flag the affected data as stale rather than treating
  it as current.
- **FR-014**: System MUST deliver a new disruption alert to the SME owner
  through a channel the owner actively monitors, fast enough that the
  owner is able to review and act on it within minutes of it being
  generated.
- **FR-015**: System MUST rank concurrent alerts by severity/urgency so an
  owner facing multiple simultaneous disruptions can tell which to address
  first.
- **FR-016**: System MUST escalate (e.g., re-notify, raise priority) an
  alert that the owner has not acted on as its predicted impact window
  approaches.

### Key Entities *(include if feature involves data)*

- **SME Profile**: An onboarded business — identity, sector, connected
  data sources, and onboarding status.
- **Supply Chain Digital Twin**: The live virtual replica of one SME's
  supply chain state — current inventory, open orders, supplier statuses,
  in-transit logistics — kept in sync with incoming operational data.
- **Supplier**: An entity the SME sources from — status (active, delayed,
  at-risk), typical lead time, and whether it is a primary or alternate/
  backup source.
- **Disruption Prediction**: An AI-generated forecast of a risk event —
  type (delay, congestion, demand spike), affected items/orders/suppliers,
  confidence, and predicted lead time before impact.
- **Alert**: A notification tied to a Disruption Prediction — status (new,
  acknowledged, acted-on, dismissed, expired/escalated), and which
  channel(s) it was delivered through.
- **Contingency Plan / Recommendation**: The step-by-step suggested actions
  (including any alternative sourcing option) tied to a Disruption
  Prediction, along with the owner's recorded decision.
- **Local Supplier Directory Entry**: A platform-curated alternative
  supplier (not registered by the SME) available as a fallback sourcing
  option — sector, location, capacity/lead time, used only when an SME has
  no suitable registered backup supplier of its own.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of disruptions the system flags are flagged at
  least 48 hours before their predicted impact.
- **SC-002**: Pilot SMEs experience at least a 40% reduction in stockout
  incidents compared to their pre-pilot baseline.
- **SC-003**: SME owners can review a disruption alert and record a
  decision (accept, modify, or dismiss a recommendation) within 5 minutes
  of receiving it.
- **SC-004**: At least 150 SMEs can complete onboarding and have an active,
  updating digital twin during the pilot without developer/IT support.
- **SC-005**: At least 90% of surveyed pilot SME owners report that alerts
  and contingency plans are clear and understandable without outside help.
- **SC-006**: Zero cross-tenant data exposure incidents occur during the
  pilot (one SME's data is never visible to another).

## Assumptions

- Alerts are delivered through at least one in-app channel plus at least
  one direct channel the owner is likely to already check (e.g., email,
  SMS, or WhatsApp); the exact channel mix is a plan-level decision.
- Onboarding uses standard self-service identity creation (e.g., phone or
  email based), consistent with the constitution's requirement for a
  radically simple, non-technical UX.
- The pilot targets UAE-based SMEs and single-country (UAE) logistics only
  for the MVP, consistent with the "complex multi-country logistics" being
  out of scope.
- "Automatically triggers alternative sourcing" from the original request
  is implemented as a configurable capability the owner opts into
  per-supplier or per-rule (FR-005), not a default always-on behavior,
  consistent with the constitution's requirement that AI actions remain
  auditable and overridable by a human.
- The platform-curated local supplier directory (FR-006 fallback) starts
  pilot-scoped (seeded with vetted UAE suppliers relevant to pilot SME
  sectors) rather than an open, self-service marketplace; broadening it is
  a post-pilot concern.

## Out of Scope (MVP)

- Full ERP replacement (this is a companion resilience layer, not a
  system-of-record replacement).
- Blockchain-based transactions or payments.
- Complex multi-country / multi-hop international logistics scenarios.
- Automated financial transactions or treasury actions (that is Track 1's
  sibling "Liquidity" theme, not this feature).
