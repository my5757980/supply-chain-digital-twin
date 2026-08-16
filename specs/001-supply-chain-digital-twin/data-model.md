# Data Model: Supply Chain Digital Twin

**Feature**: `001-supply-chain-digital-twin` | **Date**: 2026-08-14
**Source**: Derived from `spec.md` Key Entities + Functional Requirements,
and the plan's RBAC/audit-log architecture requirements.

All tables carry `tenant_id` (FK → `tenant.id`) and are protected by
PostgreSQL Row-Level Security scoped to the requesting tenant, per
`research.md` §5. `id` fields are UUIDs unless noted. Timestamps are UTC.

## Entity Overview

```
Tenant 1──* User
Tenant 1──* DataSource
Tenant 1──* Supplier
Tenant 1──* InventoryItem
Tenant 1──* Order ──* OrderLineItem ──1 InventoryItem
Order *──1 Supplier
Order 1──* LogisticsEvent
Tenant 1──* DisruptionPrediction
DisruptionPrediction 1──1 Alert
Alert 1──1 Recommendation (ContingencyPlan)
Recommendation *──0..1 Supplier (chosen alternative)
Recommendation *──0..1 LocalSupplierDirectoryEntry (chosen alternative)
Tenant 1──* AutoTriggerRule
Tenant 1──* AuditLogEntry
LocalSupplierDirectoryEntry (global, not tenant-scoped)
```

## Entities

### Tenant (SME Profile)
Maps to spec's **SME Profile**.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| business_name | text | required |
| sector | text | required; drives Local Supplier Directory matching |
| country | text | defaults `"AE"` (UAE-only for MVP per Out of Scope) |
| onboarding_status | enum | `pending`, `data_connected`, `active` |
| ai_processing_consent_at | timestamptz | nullable; set when owner consents (Constitution Principle V) |
| created_at | timestamptz | |

**Validation**: `business_name` non-empty. `onboarding_status` transitions
only forward: `pending → data_connected → active` (FR-009).
`onboarding_status` MUST NOT reach `active` while
`ai_processing_consent_at` is null — the AI prediction/recommendation loop
sends tenant supply-chain signals to the Claude API (a third-party AI
provider), so explicit, logged consent is a precondition of activation
(Constitution Principle V: "Data MUST NOT leave the system... without
explicit, logged SME consent scoped to a stated purpose"). This is the
system's one identified cross-tenant-boundary data flow.

### User
Supports the plan's RBAC requirement (research.md §6).

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK → Tenant; **nullable** only for `platform_admin` |
| email_or_phone | text | unique per tenant |
| role | enum | `owner`, `staff`, `platform_admin` |
| name | text | |
| created_at | timestamptz | |

**Validation**: exactly one `owner` required per Tenant at
`onboarding_status = active`. `platform_admin` rows are not tenant-scoped
and every action they take MUST write an AuditLogEntry (Principle V).

### DataSource
Tracks how a Tenant's data enters the system (FR-001, FR-013).

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK |
| type | enum | `manual`, `csv_upload` (MVP); `pos_integration`, `erp_integration` reserved for post-pilot |
| status | enum | `active`, `stale`, `disconnected` |
| last_synced_at | timestamptz | nullable |

**Validation**: `status = stale` MUST be set automatically when
`last_synced_at` exceeds a configurable freshness threshold (FR-013); the
Twin read-model surfaces this per affected item/supplier.

### Supplier
Maps to spec's **Supplier**.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK |
| name | text | |
| kind | enum | `primary`, `backup` (FR-006: SME's own backups) |
| status | enum | `active`, `delayed`, `at_risk` |
| typical_lead_time_days | int | |
| location | text | |

### InventoryItem

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK |
| sku | text | unique per tenant |
| name | text | |
| quantity_on_hand | numeric | |
| reorder_threshold | numeric | used by Prediction Agent for demand-spike/stockout risk |
| data_source_id | uuid | FK → DataSource |
| updated_at | timestamptz | |

### Order / OrderLineItem

| Field | Type | Notes |
|---|---|---|
| id (Order) | uuid | PK |
| tenant_id | uuid | FK |
| supplier_id | uuid | FK → Supplier |
| status | enum | `open`, `in_transit`, `delivered`, `delayed` |
| expected_date | date | |
| OrderLineItem.order_id | uuid | FK → Order |
| OrderLineItem.inventory_item_id | uuid | FK → InventoryItem |
| OrderLineItem.quantity | numeric | |

### LogisticsEvent
Feeds the "in-transit shipments" part of the Twin (User Story 1).

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| order_id | uuid | FK → Order |
| status | text | e.g., `departed`, `port_congestion`, `customs`, `out_for_delivery` |
| location | text | |
| eta | timestamptz | |
| recorded_at | timestamptz | |

### Digital Twin (read model, not a persisted write-entity)
The **Supply Chain Digital Twin** from the spec is implemented as a
computed aggregation over InventoryItem + Order + Supplier +
LogisticsEvent for a tenant, cached in Redis as `twin:{tenant_id}` and
recomputed on every relevant write (or on a short interval). It is exposed
read-only via `GET /twin` (see `contracts/`). This keeps a single source of
truth (the underlying tables) rather than a second entity that can drift
out of sync — directly supporting FR-002's "continuously updated" and User
Story 1 Acceptance Scenario 2 (reflects changes without manual refresh).

### DisruptionPrediction
Maps to spec's **Disruption Prediction**; produced by the Prediction Agent.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK |
| type | enum | `supplier_delay`, `port_congestion`, `demand_spike` |
| affected_supplier_id | uuid | FK → Supplier, nullable |
| affected_inventory_item_ids | uuid[] | |
| confidence_score | numeric(0-1) | |
| predicted_impact_at | timestamptz | must be ≥ 48h after `created_at` (FR-003, SC-001) |
| status | enum | `active`, `resolved_true_positive`, `resolved_false_positive`, `expired` |
| created_by_agent | text | e.g., `prediction-agent-v1` (Principle IV auditability) |
| created_at | timestamptz | |

**Validation**: `predicted_impact_at - created_at >= 48h` is enforced at
creation; predictions failing this MUST NOT be surfaced as an alert (they
fail SC-001 by construction). `status` is set to
`resolved_true_positive`/`resolved_false_positive` after the predicted
window passes, driving spec's "alert history including false positives."

### Alert
Maps to spec's **Alert**.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK |
| disruption_prediction_id | uuid | FK, 1:1 |
| severity | enum | `low`, `medium`, `high`, `critical` — drives ranking (FR-015) |
| status | enum | `new`, `acknowledged`, `acted_on`, `dismissed`, `escalated`, `expired` |
| channels_sent | text[] | e.g., `["in_app","email"]` |
| created_at | timestamptz | |
| escalated_at | timestamptz | nullable (FR-016) |

**State transitions**: `new → acknowledged → acted_on|dismissed`, or
`new|acknowledged → escalated` (if untouched as impact window approaches,
FR-016), `escalated → acted_on|dismissed`, any non-terminal state →
`expired` once `predicted_impact_at` passes with no action.

### Recommendation (Contingency Plan)
Maps to spec's **Contingency Plan / Recommendation**; produced by the
Sourcing Recommendation Agent + Contingency Plan Agent.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| alert_id | uuid | FK, 1:1 |
| steps | jsonb | ordered list of plain-language steps (FR-007) |
| recommended_supplier_id | uuid | FK → Supplier, nullable (FR-006 own-backup path) |
| recommended_directory_entry_id | uuid | FK → LocalSupplierDirectoryEntry, nullable (FR-006 fallback path) |
| owner_decision | enum | `pending`, `accepted`, `modified`, `dismissed` (FR-008) |
| decided_at | timestamptz | nullable |
| decided_by_user_id | uuid | FK → User, nullable |
| auto_triggered | boolean | true if executed via an AutoTriggerRule (FR-005) |

**Validation**: exactly one of `recommended_supplier_id` /
`recommended_directory_entry_id` is set, or neither (User Story 3 Scenario
3: no viable alternative — plan still shown with `steps` containing general
mitigation guidance).

### LocalSupplierDirectoryEntry
Maps to spec's **Local Supplier Directory Entry**. Global (not
tenant-scoped) — platform-curated, per `research.md` §7.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| sector | text | matched against Tenant.sector |
| location | text | |
| capacity_lead_time_days | int | |
| verified | boolean | curated/vetted flag |

### AutoTriggerRule
Supports FR-005's opt-in automatic triggering.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK |
| scope_supplier_id | uuid | FK → Supplier, nullable (null = applies by category/conditions) |
| enabled | boolean | owner-controlled |
| conditions | jsonb | e.g., max order value, confidence threshold |
| created_by_user_id | uuid | FK → User; MUST be `owner` role |

**Validation**: only a `User` with `role = owner` may create/modify a rule
(research.md §6). Every rule evaluation and every action it triggers MUST
write an AuditLogEntry.

### AuditLogEntry
Explicit user requirement ("audit logs for every AI recommendation") and
constitution Principle IV.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK, nullable for platform_admin cross-tenant actions |
| actor | text | `user:{id}` or `agent:{agent_name}` |
| action | text | e.g., `prediction.created`, `recommendation.auto_triggered`, `alert.decision_recorded` |
| entity_type | text | e.g., `DisruptionPrediction`, `Recommendation` |
| entity_id | uuid | |
| payload | jsonb | inputs/outputs relevant to the action (Principle IV: agent inputs + output must be inspectable) |
| created_at | timestamptz | |

**Validation**: write-only from the application layer (no update/delete
API); append-only, satisfying the audit trail requirement.

---

## Cross-Cutting Rules

- **Tenant isolation**: every tenant-scoped table's RLS policy is
  `USING (tenant_id = current_setting('app.tenant_id')::uuid)`, satisfying
  FR-011/SC-006.
- **48-hour lead time**: enforced at `DisruptionPrediction` creation, not
  just at alert-display time, so it can't be silently violated downstream.
- **Auditability**: any row written by `created_by_agent` (Prediction,
  Recommendation) or by an AutoTriggerRule MUST have a corresponding
  AuditLogEntry in the same transaction.
