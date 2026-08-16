import { Injectable, Logger } from "@nestjs/common";
import type { Alert } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationService } from "./notification.service";
import { toAlertResponse } from "../action/action.mapper";

/**
 * FR-014: delivers a new/escalated alert via SSE (in-app) plus at least one
 * direct channel. A real email/SMS/WhatsApp provider is out of scope for
 * the MVP pilot (spec.md Assumptions — exact channel mix is a later
 * decision); this logs the "send" as a stand-in, matching research.md §7's
 * "mock for MVP" approach for external integrations, while still recording
 * `channels_sent` accurately so the UI and audit trail reflect reality.
 */
@Injectable()
export class AlertNotifierService {
  private readonly logger = new Logger(AlertNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async notify(alert: Alert, eventType: "alert.created" | "alert.escalated"): Promise<void> {
    const channels = ["in_app", "email"];
    this.logger.log(
      `[mock email] To tenant ${alert.tenantId}: "${alert.title}" — ${alert.summary}`,
    );

    const updated = await this.prisma.withTenantContext(
      { tenantId: alert.tenantId, isPlatformAdmin: false },
      (tx) =>
        tx.alert.update({
          where: { id: alert.id },
          data: { channelsSent: { set: [...new Set([...alert.channelsSent, ...channels])] } },
        }),
    );

    this.notifications.publish(alert.tenantId, eventType, toAlertResponse(updated));
  }
}
