import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { AlertNotifierService } from "../notification/alert-notifier.service";

/**
 * FR-016: an alert the owner hasn't acted on gets escalated (re-notified,
 * raised priority) as its predicted impact window approaches, rather than
 * silently expiring. Runs across all tenants, so it uses a platform_admin
 * RLS context, same pattern as FreshnessCheckerService.
 */
@Injectable()
export class AlertEscalationService {
  private readonly logger = new Logger(AlertEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifier: AlertNotifierService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkEscalations(): Promise<void> {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    await this.runOnce();
  }

  async runOnce(): Promise<number> {
    const windowHours = Number(this.config.get<string>("ALERT_ESCALATION_WINDOW_HOURS") ?? "12");
    const cutoff = new Date(Date.now() + windowHours * 60 * 60 * 1000);

    const toEscalate = await this.prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: true },
      (tx) =>
        tx.alert.findMany({
          where: {
            status: { in: ["new", "acknowledged"] },
            disruptionPrediction: { predictedImpactAt: { lt: cutoff } },
          },
        }),
    );

    for (const alert of toEscalate) {
      const escalated = await this.prisma.withTenantContext(
        { tenantId: alert.tenantId, isPlatformAdmin: false },
        (tx) =>
          tx.alert.update({
            where: { id: alert.id },
            data: { status: "escalated", escalatedAt: new Date() },
          }),
      );
      await this.notifier.notify(escalated, "alert.escalated");
    }

    if (toEscalate.length > 0) {
      this.logger.log(`Escalated ${toEscalate.length} alert(s)`);
    }
    return toEscalate.length;
  }
}
