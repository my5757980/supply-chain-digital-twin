# SupplyTwin — AI-Driven Supply Chain Digital Twin

Built for the **du SME Resilience & Innovation Challenge** — Theme 1:
ResilienceTech, *AI-Driven Supply Chain Digital Twins*.

A live virtual replica of a UAE SME's supply chain that predicts
disruptions at least **48 hours** ahead, recommends an alternative local
supplier, and hands the owner a step-by-step plan in plain language.

---

## What it does

| | |
|---|---|
| **See** | One live screen showing stock, suppliers, orders and deliveries — replacing spreadsheets and WhatsApp status-chasing. |
| **Predict** | An AI agent watches for the warning signs of supplier delays, port congestion and demand spikes, and raises an alert ≥48h before impact. |
| **Recommend** | A sourcing agent finds an alternative — the SME's own registered backup first, then a curated directory of verified local UAE suppliers. |
| **Act** | A contingency plan the owner can accept, adjust or dismiss. Nothing is actioned automatically unless they opt in per supplier. |

Every AI decision is written to an append-only audit log.

## Architecture

```
apps/
├── web/          Next.js 14 · TypeScript · Tailwind        → Vercel
├── api/          NestJS · Prisma · PostgreSQL · Redis      → Railway
└── ai-service/   FastAPI · 3 agents · OpenAI-compatible LLM → Railway
```

The prediction layer is a **separate deployable** from the action layer —
not a convention, a physical boundary. `apps/ai-service` can only push its
output through one authenticated callback; it can never reach into
ingestion or the twin.

### Decisions worth knowing about

- **Hard guarantees live in code, not in the model.** The ≥48h lead time
  and the "own backup before directory" rule are deterministic and
  independently re-checked at the API boundary. The LLM supplies the
  confidence estimate and the wording — never the guarantee.
- **The LLM provider is configuration.** Agents talk to an
  OpenAI-compatible endpoint, so Groq, OpenAI, Gemini or a self-hosted
  model is a three-variable change (`research.md` §2).
- **Tenant isolation is enforced by the database.** PostgreSQL Row-Level
  Security with `FORCE`, and the app connects as a non-superuser role so
  the policies actually apply. It fails closed: no tenant context returns
  zero rows, never everything.
- **Third-party AI processing requires consent.** No prediction or
  recommendation is accepted for a business that hasn't explicitly agreed
  — enforced as a `403` at both AI callbacks, not just modelled.

## Running it locally

See **[quickstart.md](specs/001-supply-chain-digital-twin/quickstart.md)**
— validated end to end, including the golden path.

```bash
docker compose up -d          # Postgres + Redis
npm install                   # web + api workspaces
cd apps/api && npm run prisma:migrate && npm run start:dev
cd apps/web && npm run dev
```

## Deploying

See **[DEPLOYMENT.md](DEPLOYMENT.md)**. Read the section on the
`app_runtime` database password before exposing the database — it ships
with a development password that must be rotated.

## Tests

```bash
cd apps/api        && npx jest --runInBand   # 74 tests / 27 suites
cd apps/ai-service && pytest -q              # 22 tests
cd apps/api        && npm run load:pilot     # 150-tenant latency check
```

Contract tests are generated from
[`contracts/api.yaml`](specs/001-supply-chain-digital-twin/contracts/api.yaml),
which is served live at `/docs`.

## How this was built

Spec-driven: a constitution, then spec → plan → tasks → implementation,
with every step recorded. The artefacts are all in the repo:

- [`constitution.md`](.specify/memory/constitution.md) — the ten principles this had to satisfy
- [`spec.md`](specs/001-supply-chain-digital-twin/spec.md) — user stories and acceptance criteria
- [`plan.md`](specs/001-supply-chain-digital-twin/plan.md) — architecture and the constitution check
- [`tasks.md`](specs/001-supply-chain-digital-twin/tasks.md) — all 78 tasks, with what was verified
- [`history/prompts/`](history/prompts/) — the full build log, including the defects found and fixed

## Status

All 78 tasks complete. Known gaps before a real pilot — authentication is
still a development shim, email delivery is mocked, and the load figures
come from a laptop — are listed in
[DEPLOYMENT.md](DEPLOYMENT.md#4-known-gaps-before-a-real-pilot).
