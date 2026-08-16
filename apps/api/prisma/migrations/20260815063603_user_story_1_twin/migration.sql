-- CreateEnum
CREATE TYPE "SupplierKind" AS ENUM ('primary', 'backup');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('active', 'delayed', 'at_risk');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('open', 'in_transit', 'delivered', 'delayed');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SupplierKind" NOT NULL,
    "status" "SupplierStatus" NOT NULL DEFAULT 'active',
    "typical_lead_time_days" INTEGER,
    "location" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity_on_hand" DECIMAL(18,4) NOT NULL,
    "reorder_threshold" DECIMAL(18,4),
    "data_source_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'open',
    "expected_date" DATE,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "eta" TIMESTAMP(3),
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_tenant_id_sku_key" ON "inventory_items"("tenant_id", "sku");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_events" ADD CONSTRAINT "logistics_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (T024-T027, extending T009's pattern to the new
-- tenant-scoped tables — see init_foundational's migration for the
-- app.tenant_id / app.is_platform_admin session-variable contract, and for
-- why app_runtime must be a non-superuser role for any of this to matter).
-- Also GRANT the new tables to app_runtime, since privileges only apply to
-- tables that existed at the time of the original GRANT statement.

GRANT SELECT, INSERT, UPDATE, DELETE ON "suppliers", "inventory_items", "orders", "order_line_items", "logistics_events" TO app_runtime;

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_all ON "suppliers"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_all ON "inventory_items"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_all ON "orders"
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- order_line_items / logistics_events have no tenant_id of their own —
-- scope through the parent order's tenant instead.
ALTER TABLE "order_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_line_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_via_order ON "order_line_items"
  USING (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o.id = "order_line_items"."order_id"
        AND (
          o.tenant_id::text = current_setting('app.tenant_id', true)
          OR current_setting('app.is_platform_admin', true) = 'true'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o.id = "order_line_items"."order_id"
        AND (
          o.tenant_id::text = current_setting('app.tenant_id', true)
          OR current_setting('app.is_platform_admin', true) = 'true'
        )
    )
  );

ALTER TABLE "logistics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "logistics_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_via_order ON "logistics_events"
  USING (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o.id = "logistics_events"."order_id"
        AND (
          o.tenant_id::text = current_setting('app.tenant_id', true)
          OR current_setting('app.is_platform_admin', true) = 'true'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o.id = "logistics_events"."order_id"
        AND (
          o.tenant_id::text = current_setting('app.tenant_id', true)
          OR current_setting('app.is_platform_admin', true) = 'true'
        )
    )
  );
