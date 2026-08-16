import { Injectable } from "@nestjs/common";
import type { Alert, AlertSeverity } from "@prisma/client";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AlertFormatterService } from "./alert-formatter.service";

/**
 * FR-015: alerts are ranked by severity so an owner facing several
 * simultaneous disruptions can tell which to address first. Severity is a
 * deterministic function of the Prediction Agent's confidence score, kept
 * separate from the agent itself so the ranking rule can be tuned without
 * touching the agent (and is trivially unit-testable).
 */
export function computeSeverity(confidenceScore: number): AlertSeverity {
  if (confidenceScore >= 0.85) return "critical";
  if (confidenceScore >= 0.7) return "high";
  if (confidenceScore >= 0.5) return "medium";
  return "low";
}

@Injectable()
export class AlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formatter: AlertFormatterService,
    private readonly audit: AuditService,
  ) {}

  async createFromPrediction(context: TenantContext, predictionId: string): Promise<Alert> {
    const tenantId = context.tenantId as string;
    const prediction = await this.prisma.withTenantContext(context, (tx) =>
      tx.disruptionPrediction.findUniqueOrThrow({ where: { id: predictionId } }),
    );

    const severity = computeSeverity(prediction.confidenceScore);
    const content = await this.formatter.format(context, prediction);

    const alert = await this.prisma.withTenantContext(context, (tx) =>
      tx.alert.create({
        data: {
          tenantId,
          disruptionPredictionId: prediction.id,
          severity,
          title: content.title,
          summary: content.summary,
          channelsSent: [],
        },
      }),
    );

    await this.audit.record(context, {
      actor: "system:alert-service",
      action: "alert.created",
      entityType: "Alert",
      entityId: alert.id,
      payload: { severity, predictionId: prediction.id },
    });

    return alert;
  }
}
