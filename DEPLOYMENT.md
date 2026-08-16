# Deployment guide

Three deployables: `apps/web` on Vercel, `apps/api` and `apps/ai-service`
on Railway (alongside managed Postgres and Redis).

---

## ⚠️ Read this first: the `app_runtime` database password

`prisma/migrations/20260815044501_init_foundational/migration.sql` creates
the least-privilege `app_runtime` role with a **hard-coded development
password** (`app_runtime_local_dev`). That password is in this repository
and must be treated as public.

This matters more than it looks. Row-Level Security in this project keys
off two session variables the application sets:

```sql
current_setting('app.tenant_id')
current_setting('app.is_platform_admin')
```

Any client holding `app_runtime` credentials can simply run
`SET app.is_platform_admin = 'true'` and read **every tenant's data**. RLS
protects against application bugs; it does not protect against someone who
can open their own connection.

**Before the database is reachable from anywhere but localhost, do one of
these:**

**Option A — pre-create the role (preferred).** The migration's role
creation is wrapped in an idempotent `DO` block, so if the role already
exists it is skipped:

```sql
-- run once against the new database, before `prisma migrate deploy`
CREATE ROLE app_runtime LOGIN PASSWORD '<strong-generated-password>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
```

**Option B — rotate immediately after migrating:**

```sql
ALTER ROLE app_runtime PASSWORD '<strong-generated-password>';
```

Either way, `DATABASE_URL` must then use the new password. Verify with:

```sql
-- should fail
psql "postgresql://app_runtime:app_runtime_local_dev@<host>:5432/<db>" -c "SELECT 1;"
```

---

## 1. Railway — database, cache, and the two services

1. Create a project and add **PostgreSQL** and **Redis** plugins.
2. Handle the `app_runtime` password (above) before continuing.
3. Deploy `apps/api`:
   - Root directory: `apps/api`
   - Build: `npm install && npx prisma generate && npm run build`
   - Start: `npx prisma migrate deploy && npm run start`
   - Variables:
     | Name | Value |
     |---|---|
     | `NODE_ENV` | `production` |
     | `DATABASE_URL` | `app_runtime` connection string |
     | `MIGRATE_DATABASE_URL` | superuser connection string (migrations only) |
     | `REDIS_URL` | from the Redis plugin |
     | `SESSION_SECRET` | a long random string |
     | `AI_SERVICE_TOKEN` | a long random string |
     | `CORS_ORIGINS` | your Vercel URL, e.g. `https://supplytwin.vercel.app` |
     | `THROTTLE_LIMIT` | optional, defaults to 300/min per tenant |
4. Deploy `apps/ai-service`:
   - Root directory: `apps/ai-service`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Variables: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`,
     `API_CALLBACK_URL` (the api service's URL), `SERVICE_TOKEN` (must
     equal `AI_SERVICE_TOKEN` above).

## 2. Vercel — the frontend

- Root directory: `apps/web`
- Framework preset: Next.js
- Variables:
  | Name | Value |
  |---|---|
  | `NEXT_PUBLIC_API_URL` | your Railway api URL |
  | `NEXT_PUBLIC_SSE_URL` | `<api URL>/events/stream` |

Then set `CORS_ORIGINS` on the api service to the Vercel domain and
redeploy it — the browser rejects credentialed requests unless the origin
is listed explicitly.

## 3. Production checklist

- [ ] `app_runtime` password rotated; old one no longer works
- [ ] `SESSION_SECRET` and `AI_SERVICE_TOKEN` are long and random, not the
      dev placeholders
- [ ] `NODE_ENV=production` on the api service — this disables
      `/auth/dev-login`, which would otherwise let anyone log in as any
      user by id
- [ ] `CORS_ORIGINS` lists only your real frontend origin
- [ ] `GET /health` returns 200 on the api service
- [ ] `GET /docs` renders the API contract
- [ ] Signup → twin → alert → decision works end to end in a browser

## 4. Known gaps before a real pilot

- **Authentication is a development shim.** `/auth/dev-login` accepts a
  user id with no credential check. It is disabled when
  `NODE_ENV=production`, which means production currently has *no* login
  path — a managed auth provider must be wired in before real SMEs use
  this (see `research.md` §6).
- **Email notifications are logged, not sent.** `AlertNotifierService`
  records `channels_sent` accurately but no provider is connected.
- **Load figures are from a laptop.** See `load-test-report.md`; re-run
  against the deployed environment before committing to pilot numbers.
