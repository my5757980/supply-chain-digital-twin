-- CreateEnum
CREATE TYPE "DisruptionType" AS ENUM ('supplier_delay', 'port_congestion', 'demand_spike');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('active', 'resolved_true_positive', 'resolved_false_positive', 'expired');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('new', 'acknowledged', 'acted_on', 'dismissed', 'escalated', 'expired');

-- CreateTable
CREATE TABLE "disruption_predictions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "DisruptionType" NOT NULL,
    "affected_supplier_id" TEXT,
    "affected_inventory_item_ids" TEXT[],
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "predicted_impact_at" TIMESTAMP(3) NOT NULL,
    "status" "PredictionStatus" NOT NULL DEFAULT 'active',
    "created_by_agent" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disruption_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "disruption_prediction_id" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'new',
    "channels_sent" TEXT[],
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escalated_at" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alerts_disruption_prediction_id_key" ON "alerts"("disruption_prediction_id");

-- AddForeignKey
ALTER TABLE "disruption_predictions" ADD CONSTRAINT "disruption_predictions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disruption_predictions" ADD CONSTRAINT "disruption_predictions_affected_supplier_id_fkey" FOREIGN KEY ("affected_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_disruption_prediction_id_fkey" FOREIGN KEY ("disruption_prediction_id") REFERENCES "disruption_predictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (T042-T043, extending T009's pattern).
GRANT SELECT, INSERT, UPDATE, DELETE ON "disruption_predictions", "alerts" TO app_runtime;

ALTER TABLE "disruption_predictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disruption_predictions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_all ON "disruption_predictions"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_all ON "alerts"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );
