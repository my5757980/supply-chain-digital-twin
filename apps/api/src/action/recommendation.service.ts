import { Injectable } from "@nestjs/common";
import type { Prisma, Recommendation } from "@prisma/client";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export interface CreateRecommendationInput {
  alertId: string;
  steps: string[];
  recommendedSupplierId?: string | null;
  recommendedDirectoryEntryId?: string | null;
  autoTriggered?: boolean;
}

export type DecisionKind = "accepted" | "modified" | "dismissed";

/**
 * Every write here is paired with an AuditLogEntry — the user's explicit
 * "audit logs for every AI recommendation" requirement, and Constitution
 * Principle IV (every AI action must be auditable/overridable).
 */
@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    context: TenantContext,
    input: CreateRecommendationInput,
  ): Promise<Recommendation> {
    const recommendation = await this.prisma.withTenantContext(context, (tx) =>
      tx.recommendation.create({
        data: {
          alertId: input.alertId,
          steps: input.steps as Prisma.InputJsonValue,
          recommendedSupplierId: input.recommendedSupplierId ?? null,
          recommendedDirectoryEntryId: input.recommendedDirectoryEntryId ?? null,
          autoTriggered: input.autoTriggered ?? false,
        },
      }),
    );

    await this.audit.record(context, {
      actor: "system:recommendation-service",
      action: "recommendation.created",
      entityType: "Recommendation",
      entityId: recommendation.id,
      payload: { alertId: input.alertId, autoTriggered: input.autoTriggered ?? false },
    });

    return recommendation;
  }

  async recordDecision(
    context: TenantContext,
    recommendationId: string,
    decision: DecisionKind,
    decidedByUserId: string,
    modificationNotes?: string,
  ): Promise<Recommendation> {
    const updated = await this.prisma.withTenantContext(context, (tx) =>
      tx.recommendation.update({
        where: { id: recommendationId },
        data: { ownerDecision: decision, decidedAt: new Date(), decidedByUserId },
      }),
    );

    await this.audit.record(context, {
      actor: `user:${decidedByUserId}`,
      action: "recommendation.decision_recorded",
      entityType: "Recommendation",
      entityId: updated.id,
      payload: { decision, modificationNotes: modificationNotes ?? null },
    });

    return updated;
  }

  async findByAlertId(context: TenantContext, alertId: string): Promise<Recommendation | null> {
    return this.prisma.withTenantContext(context, (tx) =>
      tx.recommendation.findUnique({ where: { alertId } }),
    );
  }
}
