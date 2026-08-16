import { Injectable } from "@nestjs/common";
import type { DisruptionPrediction, Recommendation } from "@prisma/client";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

/**
 * FR-005: a recommendation is auto-triggered only if the owner has
 * explicitly opted in via an `AutoTriggerRule` matching this specific
 * supplier/prediction — never by default. Every auto-triggered action is
 * recorded as an AuditLogEntry naming the rule that fired.
 */
@Injectable()
export class AutoTriggerEvaluatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async evaluate(
    context: TenantContext,
    recommendation: Recommendation,
    prediction: DisruptionPrediction,
  ): Promise<Recommendation> {
    const rules = await this.prisma.withTenantContext(context, (tx) =>
      tx.autoTriggerRule.findMany({
        where: {
          enabled: true,
          OR: [
            { scopeSupplierId: null },
            ...(recommendation.recommendedSupplierId
              ? [{ scopeSupplierId: recommendation.recommendedSupplierId }]
              : []),
          ],
        },
      }),
    );

    const matchingRule = rules.find((rule) =>
      this.conditionsMatch(rule.conditions, prediction),
    );
    if (!matchingRule) {
      return recommendation;
    }

    const updated = await this.prisma.withTenantContext(context, (tx) =>
      tx.recommendation.update({
        where: { id: recommendation.id },
        data: { ownerDecision: "accepted", autoTriggered: true, decidedAt: new Date() },
      }),
    );

    await this.audit.record(context, {
      actor: `system:auto-trigger-rule:${matchingRule.id}`,
      action: "recommendation.auto_triggered",
      entityType: "Recommendation",
      entityId: updated.id,
      payload: { ruleId: matchingRule.id, conditions: matchingRule.conditions },
    });

    return updated;
  }

  private conditionsMatch(conditions: unknown, prediction: DisruptionPrediction): boolean {
    if (typeof conditions !== "object" || conditions === null) {
      return true;
    }
    const c = conditions as Record<string, unknown>;
    if (typeof c.min_confidence === "number" && prediction.confidenceScore < c.min_confidence) {
      return false;
    }
    return true;
  }
}
