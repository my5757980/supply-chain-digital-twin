import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { TwinService } from "../twin/twin.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { toSupplierResponse, type SupplierResponse } from "./ingestion.mapper";

@Controller("suppliers")
@UseGuards(AuthGuard)
export class SupplierController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twinService: TwinService,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<SupplierResponse[]> {
    const context = tenantContextFromRequest(req);
    const suppliers = await this.prisma.withTenantContext(context, (tx) =>
      tx.supplier.findMany({ orderBy: { name: "asc" } }),
    );
    return suppliers.map(toSupplierResponse);
  }

  @Post()
  async create(
    @Body() dto: CreateSupplierDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SupplierResponse> {
    const context = tenantContextFromRequest(req);
    if (!context.tenantId) {
      throw new ForbiddenException("Requires a tenant-scoped session");
    }
    const tenantId = context.tenantId;
    const supplier = await this.prisma.withTenantContext(context, (tx) =>
      tx.supplier.create({
        data: {
          tenantId,
          name: dto.name,
          kind: dto.kind,
          typicalLeadTimeDays: dto.typical_lead_time_days,
          location: dto.location,
        },
      }),
    );
    await this.twinService.refreshAndNotify(tenantId);
    return toSupplierResponse(supplier);
  }
}
