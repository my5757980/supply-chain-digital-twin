import { Body, Controller, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { RecommendationService } from "./recommendation.service";
import { AlertDecisionDto } from "./dto/alert-decision.dto";
import { toRecommendationResponse, type RecommendationResponse } from "./action.mapper";

@Controller("alerts")
@UseGuards(AuthGuard)
export class AlertDecisionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Post(":id/decision")
  async decide(
    @Param("id") alertId: string,
    @Body() dto: AlertDecisionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendationResponse> {
    const context = tenantContextFromRequest(req);
    const recommendation = await this.recommendationService.findByAlertId(context, alertId);
    if (!recommendation) {
      throw new NotFoundException("No recommendation exists for this alert");
    }

    const userId = (req.session.user as { id: string }).id;
    const updated = await this.recommendationService.recordDecision(
      context,
      recommendation.id,
      dto.decision,
      userId,
      dto.modification_notes,
    );

    await this.prisma.withTenantContext(context, (tx) =>
      tx.alert.update({
        where: { id: alertId },
        data: { status: dto.decision === "dismissed" ? "dismissed" : "acted_on" },
      }),
    );

    return toRecommendationResponse(updated);
  }
}
