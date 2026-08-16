import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { toDisruptionPredictionResponse, type DisruptionPredictionResponse } from "./action.mapper";

type PredictionStatusFilter =
  | "active"
  | "resolved_true_positive"
  | "resolved_false_positive"
  | "expired";

@Controller("predictions")
@UseGuards(AuthGuard)
export class PredictionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: PredictionStatusFilter,
  ): Promise<DisruptionPredictionResponse[]> {
    const context = tenantContextFromRequest(req);
    const predictions = await this.prisma.withTenantContext(context, (tx) =>
      tx.disruptionPrediction.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
      }),
    );
    return predictions.map(toDisruptionPredictionResponse);
  }

  @Get(":id")
  async get(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DisruptionPredictionResponse> {
    const context = tenantContextFromRequest(req);
    const prediction = await this.prisma.withTenantContext(context, (tx) =>
      tx.disruptionPrediction.findUnique({ where: { id } }),
    );
    if (!prediction) {
      throw new NotFoundException("Prediction not found");
    }
    return toDisruptionPredictionResponse(prediction);
  }
}
