-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('pending', 'data_connected', 'active');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'staff', 'platform_admin');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('manual', 'csv_upload', 'pos_integration', 'erp_integration');

-- CreateEnum
CREATE TYPE "DataSourceStatus" AS ENUM ('active', 'stale', 'disconnected');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'AE',
    "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'pending',
    "ai_processing_consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email_or_phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "DataSourceType" NOT NULL,
    "status" "DataSourceStatus" NOT NULL DEFAULT 'active',
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_or_phone_key" ON "users"("tenant_id", "email_or_phone");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (T009 / data-model.md Cross-Cutting Rules, Constitution
-- Principle III + FR-011/SC-006).
--
-- The application sets two per-request session variables before running any
-- tenant-scoped query (via `SET LOCAL` inside the request's transaction —
-- wired in the Identity/RBAC layer, T010):
--   app.tenant_id          -- the requesting user's tenant id (text form of a uuid)
--   app.is_platform_admin  -- 'true' only for an authenticated platform_admin
--
-- FORCE ROW LEVEL SECURITY is required because the application connects as
-- the same role that owns these tables; without FORCE, Postgres exempts the
-- owning role from RLS by default, which would silently defeat isolation.

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

-- Tenant creation (onboarding) legitimately happens before any tenant
-- context exists, so INSERT is unrestricted; every other operation is
-- scoped to the caller's own tenant or a platform_admin session.
CREATE POLICY tenant_isolation_insert ON "tenants"
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY tenant_isolation_select ON "tenants"
  FOR SELECT
  USING (
    id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

CREATE POLICY tenant_isolation_update ON "tenants"
  FOR UPDATE
  USING (
    id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

CREATE POLICY tenant_isolation_delete ON "tenants"
  FOR DELETE
  USING (current_setting('app.is_platform_admin', true) = 'true');

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- users.tenant_id is nullable (platform_admin rows are not tenant-scoped),
-- so a platform_admin session may also see/manage other platform_admin rows.
CREATE POLICY tenant_isolation_all ON "users"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR (tenant_id IS NULL AND current_setting('app.is_platform_admin', true) = 'true')
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR (tenant_id IS NULL AND current_setting('app.is_platform_admin', true) = 'true')
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

ALTER TABLE "data_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_sources" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_all ON "data_sources"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

ALTER TABLE "audit_log_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries" FORCE ROW LEVEL SECURITY;

-- audit_log_entries.tenant_id is nullable for cross-tenant platform_admin
-- actions; those rows are only visible to platform_admin sessions, never to
-- a regular tenant.
CREATE POLICY tenant_isolation_all ON "audit_log_entries"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR tenant_id IS NULL
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- Least-privilege runtime role -------------------------------------------
--
-- IMPORTANT: PostgreSQL's official image makes POSTGRES_USER a superuser,
-- and RLS (even with FORCE) is *never* enforced against a superuser or
-- against the owning role acting as superuser. Every application query
-- MUST run as this non-superuser role for RLS to actually isolate tenants
-- -- migrations continue to run via the superuser (Prisma's `directUrl`).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'app_runtime_local_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- The database name differs by environment: `scdt` locally, `railway` on
-- Railway, `neondb` on Neon. Hardcoding it here made this statement fail
-- with `database "scdt" does not exist` on every managed provider, taking
-- the whole migration -- and the deploy -- down with it.
DO $grant_connect$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_runtime', current_database());
END
$grant_connect$;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
