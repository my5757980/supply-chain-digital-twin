import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import { TwinEventsService } from "../notification/twin-events.service";
import { toInventoryItemResponse, toSupplierResponse } from "../ingestion/ingestion.mapper";

export interface TwinSnapshot {
  tenant_id: string;
  computed_at: string;
  inventory_summary: ReturnType<typeof toInventoryItemResponse>[];
  suppliers: ReturnType<typeof toSupplierResponse>[];
  open_orders_count: number;
  stale_data_warnings: Array<{ data_source_id: string; affected_area: string }>;
}

const CACHE_TTL_SECONDS = 30;

/**
 * The Digital Twin (spec.md's "Supply Chain Digital Twin" entity) is a
 * computed read-model, not its own write-table — see data-model.md. It is
 * cached in Redis per tenant and explicitly invalidated by every write that
 * affects it, rather than relying on TTL alone (FR-002's "continuously
 * updated" requirement).
 */
@Injectable()
export class TwinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly twinEvents: TwinEventsService,
  ) {}

  private cacheKey(tenantId: string): string {
    return `scdt:twin:${tenantId}`;
  }

  async getSnapshot(context: TenantContext): Promise<TwinSnapshot> {
    if (!context.tenantId) {
      throw new ForbiddenException("The digital twin requires a tenant-scoped session");
    }
    const cached = await this.redis.client.get(this.cacheKey(context.tenantId));
    if (cached) {
      return JSON.parse(cached) as TwinSnapshot;
    }
    const snapshot = await this.computeSnapshot(context.tenantId, context);
    await this.redis.client.set(
      this.cacheKey(context.tenantId),
      JSON.stringify(snapshot),
      "EX",
      CACHE_TTL_SECONDS,
    );
    return snapshot;
  }

  /** Called by ingestion writes (T029, T030) after anything that changes
   * the twin's underlying data — invalidates the cache and pushes a
   * `twin.updated` SSE event (T034). */
  async refreshAndNotify(tenantId: string): Promise<void> {
    await this.redis.client.del(this.cacheKey(tenantId));
    const snapshot = await this.computeSnapshot(tenantId, { tenantId, isPlatformAdmin: false });
    await this.redis.client.set(
      this.cacheKey(tenantId),
      JSON.stringify(snapshot),
      "EX",
      CACHE_TTL_SECONDS,
    );
    this.twinEvents.publishTwinUpdated(tenantId, snapshot);
  }

  private async computeSnapshot(tenantId: string, context: TenantContext): Promise<TwinSnapshot> {
    return this.prisma.withTenantContext(context, async (tx) => {
      const [inventoryItems, suppliers, openOrdersCount, staleDataSources] = await Promise.all([
        tx.inventoryItem.findMany({ orderBy: { name: "asc" } }),
        tx.supplier.findMany({ orderBy: { name: "asc" } }),
        tx.order.count({ where: { status: { in: ["open", "in_transit"] } } }),
        tx.dataSource.findMany({ where: { status: "stale" } }),
      ]);
      return {
        tenant_id: tenantId,
        computed_at: new Date().toISOString(),
        inventory_summary: inventoryItems.map(toInventoryItemResponse),
        suppliers: suppliers.map(toSupplierResponse),
        open_orders_count: openOrdersCount,
        stale_data_warnings: staleDataSources.map((ds) => ({
          data_source_id: ds.id,
          affected_area: ds.type,
        })),
      };
    });
  }
}
