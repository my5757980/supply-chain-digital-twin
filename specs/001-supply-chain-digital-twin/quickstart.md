# Quickstart: Supply Chain Digital Twin

**Feature**: `001-supply-chain-digital-twin` | **Last validated**: 2026-08-15 (T077)

Local setup for the three deployables (Principle II/IX). Every command
below was run end-to-end during T077 validation; discrepancies found
against the original planning-stage draft are corrected here.

## Prerequisites

- Node.js 20 LTS (frontend + NestJS service)
- Python 3.11+ (AI service)
- Docker Desktop (for Postgres 15 + Redis 7)
- An API key for any OpenAI-compatible LLM provider (Groq by default —
  see research.md §2). Only needed to run the agents against a real model;
  the test suites stub it.

## Services

```text
apps/
├── web/          # Next.js + TypeScript + Tailwind + shadcn/ui
├── api/          # NestJS: identity, ingestion, twin, action, notification, audit
└── ai-service/   # FastAPI: Prediction, Sourcing Recommendation, Contingency Plan agents
```

## 1. Start Postgres + Redis

```bash
# from the repo root
docker compose up -d
```

Postgres is published on **5433** (not 5432) to avoid clashing with a
native Postgres install — see `docker-compose.yml`.

## 2. Environment variables

Copy each `.env.example` to `.env` in the same directory. The values that
matter:

- `apps/api/.env`
  - `DATABASE_URL` — connects as the least-privilege `app_runtime` role so
    Row-Level Security actually applies.
  - `MIGRATE_DATABASE_URL` — the superuser connection, used only by
    `prisma migrate`. **Both are required**; RLS is silently bypassed if
    the app connects as the superuser.
  - `REDIS_URL`, `SESSION_SECRET`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`
- `apps/ai-service/.env`: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`,
  `DATABASE_URL`, `API_CALLBACK_URL`, `SERVICE_TOKEN` (must match
  `AI_SERVICE_TOKEN` above). Changing provider is just these three `LLM_*`
  values — no code change.
- `apps/web/.env`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SSE_URL`

## 3. Install and migrate

```bash
# from the repo root — npm workspaces installs web + api together
npm install

# from apps/api — applies the schema, RLS policies, the app_runtime role,
# and seeds the Local Supplier Directory
npm run prisma:migrate
```

There is no separate seed step: the Local Supplier Directory rows ship
inside the User Story 3 migration, so a migrated database is already
seeded.

```bash
# from apps/ai-service — one-time Python env
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt   # Windows
# source .venv/bin/activate && pip install -r requirements-dev.txt  # macOS/Linux
```

## 4. Run the services

```bash
# terminal 1 — NestJS on :4000
cd apps/api && npm run start:dev

# terminal 2 — FastAPI on :4100 (note the app.main path)
cd apps/ai-service && ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 4100

# terminal 3 — Next.js on :3000
cd apps/web && npm run dev
```

The API contract is browsable at <http://localhost:4000/docs>.

## 5. Verify the golden path

1. **User Story 1 — live twin.** Open <http://localhost:3000/onboarding>,
   create a business, then add stock either by typing an item in or
   uploading `apps/api/test/fixtures/sample-inventory.csv`. Continue to
   the twin view and confirm your items and suppliers appear.
2. **Grant AI consent.** Predictions are refused until the owner consents
   to third-party AI processing (Constitution Principle V). Either use the
   UI or:
   ```bash
   curl -X POST http://localhost:4000/tenants/me/ai-consent -b cookies.txt
   ```
   Skipping this is the most common reason step 3 returns `403`.
3. **User Story 2 — early warning.** Run the demo scenario:
   ```bash
   cd apps/ai-service
   ./.venv/Scripts/python.exe scripts/seed_disruption.py \
     --tenant-id <uuid> --supplier-id <uuid> \
     --supplier-name "Gulf Wholesale Trading" --item-id <uuid>
   ```
   Confirm an alert appears on `/alerts` (pushed over SSE, no refresh) with
   a predicted impact ≥ 48h out.
4. **User Story 3 — act on it.** Open the alert, review the step-by-step
   contingency plan and its recommended alternative supplier, then accept,
   adjust, or dismiss it.
5. **Audit trail.** `GET http://localhost:4000/audit-logs` (as the owner)
   should show the full chain: `tenant.onboarded` →
   `tenant.ai_processing_consent_granted` → `prediction.created` →
   `alert.created` → `recommendation.created` →
   `recommendation.decision_recorded`.

## 6. Tests

```bash
cd apps/api        && npx jest --runInBand    # 71 tests / 26 suites
cd apps/ai-service && ./.venv/Scripts/python.exe -m pytest -q   # 25 tests
cd apps/web        && npx next build          # type-checked production build
```

Pilot-scale latency check (seeds and cleans up 150 tenants):

```bash
cd apps/api && npm run load:pilot
```

See `load-test-report.md` for the recorded results.

### Known gaps

- `apps/web` has no component test runner wired up yet; frontend
  correctness currently rests on `tsc`, ESLint, a successful `next build`,
  and the backend contract tests the pages consume.
