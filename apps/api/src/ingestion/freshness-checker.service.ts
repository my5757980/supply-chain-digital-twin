import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { TwinService } from "../twin/twin.service";

/**
 * FR-013 / User Story 1 Edge Case: flags a `DataSource` as stale rather
 * than letting predictions silently rely on outdated data. Runs across all
 * tenants, so it necessarily uses a platform_admin RLS context.
 */
@Injectable()
export class FreshnessCheckerService {
  private readonly logger = new Logger(FreshnessCheckerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly twinService: TwinService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkStaleness(): Promise<void> {
    // Each test suite boots its own full AppModule (its own cron
    // registration); tests call `runOnce()` directly instead, so skip the
    // scheduled firing here to avoid N concurrent instances racing against
    // each other's Prisma connection during test teardown.
    if (process.env.NODE_ENV === "test") {
      return;
    }
    await this.runOnce();
  }

  /** Exposed separately so tests can trigger a check without waiting on
   * the cron schedule. */
  async runOnce(): Promise<number> {
    const thresholdMinutes = Number(
      this.config.get<string>("DATA_FRESHNESS_THRESHOLD_MINUTES") ?? "60",
    );
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);

    const { affectedTenantIds, count } = await this.prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: true },
      async (tx) => {
        const toFlag = await tx.dataSource.findMany({
          where: { status: "active", lastSyncedAt: { lt: cutoff } },
          select: { id: true, tenantId: true },
        });
        if (toFlag.length === 0) {
          return { affectedTenantIds: [] as string[], count: 0 };
        }
        await tx.dataSource.updateMany({
          where: { id: { in: toFlag.map((d) => d.id) } },
          data: { status: "stale" },
        });
        return {
          affectedTenantIds: [...new Set(toFlag.map((d) => d.tenantId))],
          count: toFlag.length,
        };
      },
    );

    // The twin's Redis cache doesn't expire fast enough on its own for a
    // freshness change to be reflected promptly — invalidate + notify
    // explicitly, same as any other twin-affecting write (T034).
    await Promise.all(
      affectedTenantIds.map((tenantId) => this.twinService.refreshAndNotify(tenantId)),
    );

    if (count > 0) {
      this.logger.log(`Flagged ${count} data source(s) as stale`);
    }
    return count;
  }
}
