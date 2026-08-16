import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { Roles } from "../identity/roles.decorator";
import { RolesGuard } from "../identity/roles.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { CreateAutoTriggerRuleDto } from "./dto/create-auto-trigger-rule.dto";
import { toAutoTriggerRuleResponse, type AutoTriggerRuleResponse } from "./action.mapper";

@Controller("auto-trigger-rules")
@UseGuards(AuthGuard, RolesGuard)
export class AutoTriggerRuleController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles("owner")
  async list(@Req() req: AuthenticatedRequest): Promise<AutoTriggerRuleResponse[]> {
    const context = tenantContextFromRequest(req);
    const rules = await this.prisma.withTenantContext(context, (tx) =>
      tx.autoTriggerRule.findMany(),
    );
    return rules.map(toAutoTriggerRuleResponse);
  }

  @Post()
  @Roles("owner")
  async create(
    @Body() dto: CreateAutoTriggerRuleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AutoTriggerRuleResponse> {
    const context = tenantContextFromRequest(req);
    if (!context.tenantId) {
      throw new ForbiddenException("Requires a tenant-scoped session");
    }
    const tenantId = context.tenantId;
    const userId = (req.session.user as { id: string }).id;

    const rule = await this.prisma.withTenantContext(context, (tx) =>
      tx.autoTriggerRule.create({
        data: {
          tenantId,
          scopeSupplierId: dto.scope_supplier_id,
          enabled: dto.enabled,
          conditions: (dto.conditions ?? {}) as Prisma.InputJsonValue,
          createdByUserId: userId,
        },
      }),
    );
    return toAutoTriggerRuleResponse(rule);
  }
}
