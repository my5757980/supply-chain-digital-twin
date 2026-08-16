import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { Prisma, type DisruptionPrediction } from "@prisma/client";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AlertService } from "../action/alert.service";
import { SourcingCandidatesService, type SourcingCandidates } from "../action/sourcing-candidates.service";
import { AlertNotifierService } from "../notification/alert-notifier.service";
import { TenantService } from "../identity/tenant.service";
import { ServiceTokenGuard } from "./service-token.guard";
import { CreatePredictionDto } from "./dto/create-prediction.dto";

const MINIMUM_LEAD_TIME_MS = 48 * 60 * 60 * 1000;

export interface PredictionCallbackResponse {
  prediction_id: string;
  alert_id: string;
  /** Lets apps/ai-service's Sourcing Recommendation Agent pick between the
   * tenant's own backups and the Local Supplier Directory (FR-006)
   * without apps/api needing to know that agent's selection policy. */
  sourcing_candidates: SourcingCandidates;
}

/**
 * Receives predictions from apps/ai-service (T046). Defense in depth: the
 * Prediction Agent already enforces the ≥48h floor (FR-003), but this API
 * boundary re-checks it independently rather than trusting the caller —
 * the guarantee is a product requirement, not just an agent implementation
 * detail.
 */
@Controller("internal/predictions")
@UseGuards(ServiceTokenGuard)
export class PredictionsCallbackController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alertService: AlertService,
    private readonly notifier: AlertNotifierService,
    private readonly sourcingCandidates: SourcingCandidatesService,
    private readonly tenantService: TenantService,
  ) {}

  @Post()
  async create(@Body() dto: CreatePredictionDto): Promise<PredictionCallbackResponse> {
    const predictedImpactAt = new Date(dto.predicted_impact_at);
    if (predictedImpactAt.getTime() - Date.now() < MINIMUM_LEAD_TIME_MS) {
      throw new UnprocessableEntityException(
        "predicted_impact_at must be at least 48 hours from now",
      );
    }

    const context: TenantContext = { tenantId: dto.tenant_id, isPlatformAdmin: false };

    // Constitution Principle V: refuse to accept (and therefore to store or
    // act on) AI-derived output for a tenant that never consented to their
    // data being processed by a third-party model. Enforced here, at the
    // trust boundary, rather than relying on the caller to have checked.
    if (!(await this.tenantService.hasAiProcessingConsent(context))) {
      throw new ForbiddenException(
        "This business has not consented to AI processing of their supply chain data",
      );
    }

    const prediction = await this.createPrediction(context, dto, predictedImpactAt);

    await this.audit.record(context, {
      actor: `agent:${dto.created_by_agent}`,
      action: "prediction.created",
      entityType: "DisruptionPrediction",
      entityId: prediction.id,
      payload: { type: dto.type, confidence_score: dto.confidence_score },
    });

    const alert = await this.alertService.createFromPrediction(context, prediction.id);
    await this.notifier.notify(alert, "alert.created");

    const candidates = await this.sourcingCandidates.findFor(context);

    return { prediction_id: prediction.id, alert_id: alert.id, sourcing_candidates: candidates };
  }

  /**
   * Translates a foreign-key violation (a stale/invalid supplier or
   * inventory item id from the caller) into a clean `422` instead of
   * leaking a raw Prisma stack trace as an unhandled `500` — the AI
   * service's signal generation and its callback aren't atomic with the
   * twin's own state, so a reference going stale between the two is a
   * real, expected failure mode, not a defect.
   */
  private async createPrediction(
    context: TenantContext,
    dto: CreatePredictionDto,
    predictedImpactAt: Date,
  ): Promise<DisruptionPrediction> {
    try {
      return await this.prisma.withTenantContext(context, (tx) =>
        tx.disruptionPrediction.create({
          data: {
            tenantId: dto.tenant_id,
            type: dto.type,
            affectedSupplierId: dto.affected_supplier_id,
            affectedInventoryItemIds: dto.affected_inventory_item_ids,
            confidenceScore: dto.confidence_score,
            predictedImpactAt,
            createdByAgent: dto.created_by_agent,
            rationale: dto.rationale,
          },
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new UnprocessableEntityException(
          "affected_supplier_id does not reference an existing supplier for this tenant",
        );
      }
      throw error;
    }
  }
}
