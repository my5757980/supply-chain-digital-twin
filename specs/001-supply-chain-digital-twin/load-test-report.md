# Pilot-Scale Load Test Report (T075)

**Feature**: `001-supply-chain-digital-twin` | **Date**: 2026-08-15
**Script**: `apps/api/test/load/pilot-load.ts` (`npm run load:pilot` in `apps/api`)

## What this measures

SC-003 requires that "SME owners can review a disruption alert and record a
decision within 5 minutes of receiving it." Two server paths sit inside
that budget:

1. **Alert delivery** — `POST /internal/predictions`: the AI service's
   prediction is persisted, an `Alert` is generated and formatted in plain
   language, and the owner is notified (SSE + direct channel). This is the
   gap between "we spotted it" and "the owner can see it".
2. **Twin read** — `GET /twin`: the dashboard the owner lands on.

The test seeds the pilot's full tenant count and measures per-request
latency with that dataset present.

## Configuration

| Setting | Value |
|---|---|
| Tenants | 150 (the pilot target, FR-010 / SC-004) |
| Inventory items per tenant | 20 (3,000 rows total) |
| Suppliers per tenant | 1 |
| Predictions issued | 150 (one per tenant) |
| Environment | Local Postgres 15 + Redis 7 (Docker), single Node process |

## Results

| Path | n | p50 | p95 | max |
|---|---|---|---|---|
| Alert delivery (`POST /internal/predictions`) | 150 | 111 ms | **234 ms** | 1,093 ms |
| Twin read (`GET /twin`) | 150 | 33 ms | **50 ms** | 78 ms |

**SC-003 budget**: 300,000 ms. **Worst p95**: 234 ms — roughly **1,280×
headroom**. ✅ PASS.

## What this does and does not establish

**Does**: per-request latency on both SC-003 paths does not degrade into
anything close to the 5-minute budget once the database holds a full
pilot's worth of tenants and inventory. The twin's Redis snapshot cache and
the RLS-scoped queries both hold up at 150 tenants / 3,000 items.

**Does not**: this is sequential, not concurrent, and runs against a single
local Postgres/Redis on a development laptop. It is not a throughput or
capacity measurement — a concurrency number from this setup would describe
the laptop more than the product. The `max` of 1,093 ms on alert delivery
is a first-request/JIT-warmup artifact, not a steady-state figure.

**Before the real pilot**, this should be re-run against the deployed
Railway environment with concurrent virtual users, which is the only place
a meaningful capacity number can come from. The headroom measured here
(three orders of magnitude) makes it very unlikely that SC-003 is at risk,
but "unlikely" is not the same as "measured in production conditions".

## Reproducing

```bash
cd apps/api
npm run load:pilot                       # defaults: 150 tenants x 20 items
LOAD_TENANTS=500 LOAD_ITEMS=50 npm run load:pilot   # heavier run
```

The script cleans up every tenant it creates, including on failure.
