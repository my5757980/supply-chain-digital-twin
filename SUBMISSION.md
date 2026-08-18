# SupplyTwin — du SME Resilience & Innovation Challenge

**Track:** Theme 1, ResilienceTech — AI-Driven Supply Chain Digital Twins
**Submitted by:** Muhammad Yaseen
**Code:** github.com/my5757980/supply-chain-digital-twin

> **What stage this is at.** SupplyTwin is a working system, not a concept
> deck with screenshots. Every number in the demo is produced by the running
> software against a real language model. Section 5 states precisely what is
> built, what is simulated, and what is not built yet — because a pilot with
> 150 real businesses fails on the gap between those three, and it is
> cheaper to name that gap now than to discover it in week six.

---

## 1. Concept Summary

### What it is

A live digital twin of a small business's supply chain: one continuously
updated model of its stock, suppliers and open orders, which watches for the
pattern that precedes a disruption and hands the owner a decision rather
than a dashboard.

### The problem, concretely

A UAE grocery distributor finds out its supplier is late on the morning the
delivery does not arrive. By then both options are bad: pay a premium for an
emergency order, or tell customers the shelf is empty. The information that
would have prevented it — this supplier has slipped three times in thirty
days, and stock of that item is below reorder level — already existed. It
was just never assembled in one place, and nobody had time to assemble it.

Larger firms solve this with supply chain planners and six-figure ERP
modules. An SME has neither.

### How it works in practice

1. **Ingest.** The business connects its stock and supplier data — CSV
   upload, manual entry, or API. Setup takes about two minutes and needs no
   IT project.
2. **Model.** The platform maintains a live twin: what is in stock, which
   suppliers serve which items, typical lead times, which items are below
   their reorder level.
3. **Predict.** A prediction agent evaluates supplier signals against that
   twin and raises a disruption prediction with a confidence score and a
   plain-language rationale.
4. **Source.** A sourcing agent selects an alternative — *the business's own
   registered backup supplier first*, and only then a directory of verified
   local suppliers. This is deterministic code, not a model decision.
5. **Plan.** A contingency agent writes a step-by-step plan in the language
   an owner uses, not a planner's.
6. **Decide.** The owner accepts, adjusts, or dismisses. Nothing is actioned
   without them unless they have explicitly opted in to automatic action for
   a specific supplier above a specific confidence threshold.

### Three design decisions that define the product

**The AI does not get to decide the guarantees.** The 48-hour minimum lead
time and the sourcing priority are ordinary code with tests around them. The
model writes the explanation and the confidence, never the rule. A model that
drifts changes the wording of an alert; it cannot change how early the alert
fires or whose supplier gets recommended.

**Tenant isolation is enforced by the database, not the application.**
PostgreSQL row-level security, with `FORCE ROW LEVEL SECURITY`, running
under a non-superuser role — because a superuser silently bypasses RLS even
when it is forced. Missing tenant context returns zero rows rather than
every row: it fails closed. For 40,000 SMEs on shared infrastructure, an
application-layer check is one forgotten `WHERE` clause away from a breach.

**The system shows the predictions it got wrong.** The track-record page
lists every warning, including the ones that turned out to be nothing.
Hiding them would make the accuracy look better than it is, and an owner who
cannot see the misses has no basis for deciding how much to trust the hits.

---

## 2. Integration Plan

### API-first, contract-first

Every capability is an HTTP endpoint before it is a screen. The OpenAPI 3
contract is the source of truth, lives in the repository, and is served at
`/docs` on the running service. A test in the suite parses it on every
commit — it had been silently invalid for weeks until that test was added,
which is exactly the failure mode a contract is supposed to prevent.

Anything the web app can do, a du system or a partner can do.

### Three ingestion paths, by SME maturity

| Path | For | Effort for the SME |
|---|---|---|
| **CSV upload** | Businesses running on spreadsheets — most of them | Export, drag, done |
| **Manual entry** | The smallest, with a handful of SKUs | Two minutes |
| **REST API + webhooks** | Businesses with a POS or accounting system | A developer afternoon |

The freshness checker flags any source that stops reporting and marks the
twin stale rather than quietly serving old numbers as current.

### Where it meets du

- **Identity.** Onboarding is a thin, replaceable module. A du SSO or
  du Business account becomes the identity provider without touching the
  twin, prediction or action services.
- **Distribution.** du already bills these businesses. The pilot cohort is
  a segment query, not a marketing campaign — that is the single largest
  structural advantage this challenge offers, and the plan below is built
  around it.
- **Notification.** Alerts are emitted through a channel abstraction that
  already records intent per channel. Wiring du's SMS or WhatsApp gateway is
  a provider implementation, not a redesign.
- **Supplier directory.** The local-supplier directory is a first-class
  entity. A du-verified supplier list drops in as a data source.

### Deployment and portability

Three services — web, platform API, AI service — each containerised, each
horizontally scalable, sharing PostgreSQL and Redis. Nothing is tied to one
cloud. The language model sits behind an OpenAI-compatible client, so the
provider is three environment variables rather than a code change; the
system has been run against more than one provider already.

### 100% digital

No step in the core loop requires a phone call, a branch visit, or a
person to re-key anything: signup, data connection, consent, prediction,
recommendation, decision and audit are all in-product.

---

## 3. Pilot Strategy — 150+ du SME partners

The pilot is staged, and each stage has an exit test. A system that
mispredicts for 150 businesses at once does not get a second chance with
them, so the cohort widens only when the previous stage has earned it.

### Stage 0 — Design partners (5 SMEs, weeks 1–2)

Five businesses across food distribution, retail and spare parts. The goal
is not usage metrics; it is to have a practitioner correct the system's
judgement. **What we most need is not in any public document:** what tells a
buyer a supplier is slipping before the supplier says so, what they check
before moving an order, and which decision they would never delegate.

**Exit test:** three of five confirm the plans read like something they
would actually send.

### Stage 1 — Closed pilot (25 SMEs, weeks 3–6)

A du segment query gives the cohort: SMEs holding physical stock with more
than one supplier. Onboarding is self-serve; we watch where people stop.

**Exit test:** ≥80% complete onboarding unaided; ≥1 genuine disruption
correctly predicted ≥48h ahead; zero cross-tenant data incidents.

### Stage 2 — Scale pilot (150+ SMEs, weeks 7–16)

Full cohort, in three waves of roughly fifty so that a defect found in wave
one does not reach wave three. Automatic action stays opt-in throughout.

**Exit test:** the Success Metrics below, measured against each business's
own first four weeks as its baseline.

### How SMEs are recruited and kept

- **Recruited** through du's existing SME relationship — an email to a known
  customer, not a cold campaign.
- **Onboarded** in about two minutes, with no integration project. If it
  takes longer than that, the SME will not finish, and the pilot has no data.
- **Kept** by being useful in week one: the twin shows something worth
  seeing — items below reorder level, suppliers already slipping — before
  any prediction has been made.

### What we measure honestly

Every prediction is recorded with its outcome, including false positives,
and false positives are reported to du as a headline number rather than a
footnote. A 95% accuracy claim that quietly excludes the misses is worth
less than an 80% claim that does not.

---

## 4. Success Metrics

Each KPI is measured against the business's own first four weeks on the
platform, before any alert is acted on. Targets are what the pilot is
designed to validate — not results already achieved.

| # | KPI | Baseline | Target | How it is measured |
|---|---|---|---|---|
| 1 | **Warning lead time** | 0h — found out on delivery day | **≥48h** before the predicted impact date | Timestamp of alert vs predicted impact date, per alert. Enforced in code, not aspirational |
| 2 | **Stockout risk reduction** | The business's own stockout rate in weeks 1–4 | **≥40% fewer** stockouts on items covered by an acted-on alert | Items below reorder with no inbound order, before vs after |
| 3 | **Time from warning to action** | Days — the current cycle is find out, call around, decide | **Under 10 minutes**, median | Alert delivered → owner decision recorded |
| 4 | **Alternative found rate** | n/a | **≥90%** of alerts carry a named alternative supplier | Alerts with a recommendation attached ÷ total alerts |
| 5 | **Owner acceptance rate** | n/a | **≥50%** of plans accepted or adjusted rather than dismissed | Decision outcomes. This is the real usefulness test — a plan nobody accepts is a plan that was wrong |
| 6 | **False positive rate** | n/a | **Published, whatever it is.** Target ≤30% by end of pilot | Predictions whose disruption never materialised. Shown in-product to the SME, not just to du |
| 7 | **Onboarding completion** | n/a | **≥80%** finish unaided, median under 5 minutes | Funnel from signup to first twin view |

Metric 3 maps directly to the challenge's "business pivot speed" example:
the pivot here is moving an order to a different supplier, and the cycle
goes from days to minutes.

---

## 5. Risk Mitigation

### What is real today, stated plainly

**Built and working:** the twin, the three agents against a live model,
consent enforcement, row-level tenant isolation, the audit trail,
opt-in automatic action, the track-record page, and the full API contract.
96 automated tests (74 platform, 22 AI service). A load test at pilot scale
— 150 tenants, 3,000 inventory items — returned alert delivery p95 of 234ms
and twin reads p95 of 50ms against a 5-minute budget. That figure is
**sequential latency measured on a developer laptop**, not a concurrency or
capacity measurement, and the report says so. Re-running it on the deployed
environment is a gate before the Stage 2 cohort, not after.

**Simulated, not live:** supplier disruption signals. The prediction logic is
real; the feed is seeded. Live carrier and port data is a pilot-stage
integration, and is scoped as such rather than implied.

**Not built yet:** production authentication (login is a development shim),
outbound email and SMS delivery (intent is recorded, nothing is sent), and
deployment to a hosted environment.

### Risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Cross-tenant data leak** | 150, then 40,000 businesses on shared infrastructure. One leak ends the pilot | Enforced in PostgreSQL, not the app. RLS with FORCE, non-superuser runtime role, fails closed on missing context. Covered by dedicated isolation tests |
| **A wrong recommendation costs an SME real money** | An unnecessary emergency order is a direct loss | The owner decides. Automatic action is off by default, opt-in per supplier, and gated on a confidence threshold they set. Every recommendation is audit-logged with its inputs |
| **The model drifts, or the provider changes it** | Today's confidence scores stop meaning what they meant | The guarantees are not in the model. The 48-hour floor and sourcing priority are code with tests. The model writes prose and a score; it cannot move the rule |
| **PDPL and data residency** | UAE personal data protection applies to SME and supplier records | No data reaches a model without explicit consent — enforced as a 403, not a checkbox. Consent is revocable. Deployment is region-portable; nothing is tied to one cloud |
| **Model provider outage or price change** | A single-vendor dependency is a single point of failure | Provider-agnostic client. Switching is three environment variables. Already exercised against more than one provider |
| **SMEs abandon onboarding** | No data, no twin, no pilot | Two-minute self-serve setup, three ingestion paths, and the twin is useful before the first prediction. Drop-off is measured as KPI 7 |
| **Alert fatigue** | Too many false alarms and the alerts get ignored — the classic failure of this product category | False positive rate is a published KPI, shown to the SME. Escalation is staged, and the track record is visible so trust is earned rather than assumed |
| **Stale data presented as current** | A confident twin built on last month's numbers is worse than no twin | A freshness checker marks sources stale and flags the twin, rather than serving old numbers silently |
| **Scaling to 40,000 tenants** | The must-have | Stateless services behind a shared PostgreSQL and Redis, horizontally scalable, tenant isolation at the row level rather than one database per customer. Validated at 150 tenants; the next gate is 1,500 |

### The honest summary

The engineering is further along than a hackathon concept usually is, and
the product judgement is further behind — because the judgement belongs to
people who have run procurement for a decade, and that is what Stage 0 of
the pilot is for. We would rather say that than present a system whose rules
were guessed at by its author.

---

## Must-haves

| Requirement | How it is met |
|---|---|
| **Built for rapid scalability** | Three independently scalable stateless services, containerised, shared Postgres and Redis, no per-customer infrastructure |
| **100% digital integration** | Signup, data connection, consent, prediction, recommendation, decision and audit all in-product. No manual or offline step in the core loop |
| **Scalable to 40,000+ SMEs** | Row-level tenant isolation on shared tables rather than a database per customer. Load-tested at 150 tenants and 3,000 items; architecture and next validation gate documented |
