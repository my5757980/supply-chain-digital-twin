-- CreateEnum
CREATE TYPE "RecommendationDecision" AS ENUM ('pending', 'accepted', 'modified', 'dismissed');

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "recommended_supplier_id" TEXT,
    "recommended_directory_entry_id" TEXT,
    "owner_decision" "RecommendationDecision" NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" TEXT,
    "auto_triggered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_supplier_directory_entries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "location" TEXT,
    "capacity_lead_time_days" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "local_supplier_directory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_trigger_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scope_supplier_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "created_by_user_id" TEXT NOT NULL,

    CONSTRAINT "auto_trigger_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_alert_id_key" ON "recommendations"("alert_id");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_recommended_supplier_id_fkey" FOREIGN KEY ("recommended_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_recommended_directory_entry_id_fkey" FOREIGN KEY ("recommended_directory_entry_id") REFERENCES "local_supplier_directory_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_trigger_rules" ADD CONSTRAINT "auto_trigger_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_trigger_rules" ADD CONSTRAINT "auto_trigger_rules_scope_supplier_id_fkey" FOREIGN KEY ("scope_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_trigger_rules" ADD CONSTRAINT "auto_trigger_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- data-model.md validation rule: "exactly one of recommended_supplier_id /
-- recommended_directory_entry_id is set, or neither" — enforced as a real
-- DB constraint, not just application-layer trust.
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_at_most_one_source_chk"
  CHECK (NOT (recommended_supplier_id IS NOT NULL AND recommended_directory_entry_id IS NOT NULL));

-- Row-Level Security (T061, T063 — extending T009's pattern).
GRANT SELECT, INSERT, UPDATE, DELETE ON "recommendations", "local_supplier_directory_entries", "auto_trigger_rules" TO app_runtime;

-- recommendations has no tenant_id of its own — scope via the parent alert
-- (same pattern as order_line_items/logistics_events in the US1 migration).
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recommendations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_via_alert ON "recommendations"
  USING (
    EXISTS (
      SELECT 1 FROM "alerts" a
      WHERE a.id = "recommendations"."alert_id"
        AND (
          a.tenant_id::text = current_setting('app.tenant_id', true)
          OR current_setting('app.is_platform_admin', true) = 'true'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "alerts" a
      WHERE a.id = "recommendations"."alert_id"
        AND (
          a.tenant_id::text = current_setting('app.tenant_id', true)
          OR current_setting('app.is_platform_admin', true) = 'true'
        )
    )
  );

ALTER TABLE "auto_trigger_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auto_trigger_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_all ON "auto_trigger_rules"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- local_supplier_directory_entries is deliberately global / NOT tenant-scoped
-- (research.md §7): every tenant may read it, no RLS restricts SELECT. It's
-- platform-curated, so writes are expected to come only from trusted seed/
-- admin paths, not tenant-facing endpoints — the application layer never
-- exposes a tenant-facing write route for this table.

-- Seed data (T062): at least one verified entry per pilot-relevant sector.
INSERT INTO "local_supplier_directory_entries" (id, name, sector, location, capacity_lead_time_days, verified) VALUES
  (gen_random_uuid()::text, 'Al Futtaim General Trading', 'retail', 'Dubai, UAE', 5, true),
  (gen_random_uuid()::text, 'Gulf Food Distribution Co.', 'food', 'Sharjah, UAE', 3, true),
  (gen_random_uuid()::text, 'Emirates Logistics Partners', 'logistics', 'Abu Dhabi, UAE', 4, true),
  (gen_random_uuid()::text, 'Union Coop Wholesale', 'retail', 'Dubai, UAE', 6, true),
  (gen_random_uuid()::text, 'Barakat Fresh Supplies', 'food', 'Dubai, UAE', 2, true);
