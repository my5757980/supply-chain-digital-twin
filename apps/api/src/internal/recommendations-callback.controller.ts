import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";
import { RecommendationService } from "../action/recommendation.service";
import { AutoTriggerEvaluatorService } from "../action/auto-trigger-evaluator.service";
import { toRecommendationResponse, type RecommendationResponse } from "../action/action.mapper";
import { TenantService } from "../identity/tenant.service";
import { ServiceTokenGuard } from "./service-token.guard";
import { CreateRecommendationDto } from "./dto/create-recommendation.dto";

/**
 * Receives Sourcing Recommendation / Contingency Plan Agent output from
 * apps/ai-service (T066) and persists it alongside its Alert. Every
 * recommendation is then checked against the tenant's opt-in
 * AutoTriggerRules (FR-005) before being returned.
 */
@Controller("internal/recommendations")
@UseGuards(ServiceTokenGuard)
export class RecommendationsCallbackController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationService: RecommendationService,
    private readonly autoTriggerEvaluator: AutoTriggerEvaluatorService,
    private readonly tenantService: TenantService,
  ) {}

  @Post()
  async create(@Body() dto: CreateRecommendationDto): Promise<RecommendationResponse> {
    const context: TenantContext = { tenantId: dto.tenant_id, isPlatformAdmin: false };

    // Same Principle V gate as the predictions callback — see that
    // controller for the reasoning.
    if (!(await this.tenantService.hasAiProcessingConsent(context))) {
      throw new ForbiddenException(
        "This business has not consented to AI processing of their supply chain data",
      );
    }

    const recommendation = await this.createRecommendation(context, dto);

    const alert = await this.prisma.withTenantContext(context, (tx) =>
      tx.alert.findUniqueOrThrow({
        where: { id: dto.alert_id },
        include: { disruptionPrediction: true },
      }),
    );

    const evaluated = await this.autoTriggerEvaluator.evaluate(
      context,
      recommendation,
      alert.disruptionPrediction,
    );

    return toRecommendationResponse(evaluated);
  }

  /**
   * Same defense-in-depth pattern as predictions-callback.controller.ts:
   * a stale supplier/directory-entry reference from the caller becomes a
   * clean 422, not a raw Prisma stack trace.
   */
  private async createRecommendation(
    context: TenantContext,
    dto: CreateRecommendationDto,
  ): ReturnType<RecommendationService["create"]> {
    try {
      return await this.recommendationService.create(context, {
        alertId: dto.alert_id,
        steps: dto.steps,
        recommendedSupplierId: dto.recommended_supplier_id,
        recommendedDirectoryEntryId: dto.recommended_directory_entry_id,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new UnprocessableEntityException(
          "alert_id, recommended_supplier_id, or recommended_directory_entry_id does not reference an existing row",
        );
      }
      throw error;
    }
  }
}
