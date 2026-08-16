# Test suite notes

## Running

```bash
npx jest --runInBand    # 74 tests / 27 suites
```

`--runInBand` is required: every suite boots its own Nest application
against the same Postgres and Redis, and running them in parallel makes
them contend for the database.

## Why `testTimeout` is 60s

Each suite's `beforeAll` boots a full `AppModule` — Prisma connects, Redis
connects, and the BullMQ ingestion worker starts. That takes a few seconds
normally, but noticeably longer when the machine is busy (for example when
the dev servers are also running).

The timeout was originally 5s (Jest's default), then 30s. Both produced
*intermittent* failures that looked like real bugs but were just slow
bootstraps being cut off — `auth.spec.ts` failing after 35s was the
clearest case. 60s is generous enough to absorb that variance while still
catching a genuine hang.

If the whole suite feels slow, the underlying cause is that 27 suites each
pay the full app-bootstrap cost. Sharing one application across suites
would be the real fix; it hasn't been needed yet.

## Cleaning up test data

`cleanupTenant` in `helpers/test-app.ts` deletes a tenant **and its
children**, in dependency order.

Two tables need explicit deletion and are easy to miss: `users` and
`audit_log_entries` both use `ON DELETE SET NULL` on `tenant_id`, so
deleting the tenant silently orphans their rows instead of failing. An
earlier version of the helper skipped them and leaked several hundred rows
across runs before anyone noticed.

To check for leaks:

```sql
SELECT count(*) FROM users WHERE tenant_id IS NULL AND role <> 'platform_admin';
SELECT count(*) FROM audit_log_entries WHERE tenant_id IS NULL;
```

Both should be 0 on a clean database.

## Test app must mirror production

`createTestApp` deliberately applies the same global pipes and filters as
`src/main.ts`. A suite that bootstraps its own app will drift — that
already happened once, when `auth.spec.ts` was missing the global
exception filter and was therefore asserting against a different error
shape than the one that ships. Use the helper.
