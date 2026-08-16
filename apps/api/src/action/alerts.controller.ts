import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import {
  toAlertResponse,
  toDisruptionPredictionResponse,
  toRecommendationResponse,
  type AlertResponse,
  type DisruptionPredictionResponse,
  type RecommendationResponse,
} from "./action.mapper";

type AlertStatusFilter = "new" | "acknowledged" | "acted_on" | "dismissed" | "escalated" | "expired";

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** Extends the base Recommendation contract with denormalized names — the
 * UI needs "Backup Co" not just a supplier id, and this is the one read
 * path that benefits from the join. */
export interface RecommendationDetailResponse extends RecommendationResponse {
  recommended_supplier_name: string | null;
  recommended_directory_entry_name: string | null;
}

export interface AlertDetailResponse extends AlertResponse {
  prediction: DisruptionPredictionResponse;
  recommendation: RecommendationDetailResponse | null;
}

@Controller("alerts")
@UseGuards(AuthGuard)
export class AlertsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: AlertStatusFilter,
  ): Promise<AlertResponse[]> {
    const context = tenantContextFromRequest(req);
    const alerts = await this.prisma.withTenantContext(context, (tx) =>
      tx.alert.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
      }),
    );
    // FR-015: severity desc, then created_at desc (already the DB order).
    const ranked = [...alerts].sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
    );
    return ranked.map(toAlertResponse);
  }

  @Get(":id")
  async get(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AlertDetailResponse> {
    const context = tenantContextFromRequest(req);
    const alert = await this.prisma.withTenantContext(context, (tx) =>
      tx.alert.findUnique({
        where: { id },
        include: {
          disruptionPrediction: true,
          recommendation: {
            include: { recommendedSupplier: true, recommendedDirectoryEntry: true },
          },
        },
      }),
    );
    if (!alert) {
      throw new NotFoundException("Alert not found");
    }
    return {
      ...toAlertResponse(alert),
      prediction: toDisruptionPredictionResponse(alert.disruptionPrediction),
      recommendation: alert.recommendation
        ? {
            ...toRecommendationResponse(alert.recommendation),
            recommended_supplier_name: alert.recommendation.recommendedSupplier?.name ?? null,
            recommended_directory_entry_name:
              alert.recommendation.recommendedDirectoryEntry?.name ?? null,
          }
        : null,
    };
  }
}
