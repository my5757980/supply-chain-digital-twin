import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { TwinService } from "../twin/twin.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { toInventoryItemResponse, type InventoryItemResponse } from "./ingestion.mapper";

@Controller("inventory-items")
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twinService: TwinService,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<InventoryItemResponse[]> {
    const context = tenantContextFromRequest(req);
    const items = await this.prisma.withTenantContext(context, (tx) =>
      tx.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    );
    return items.map(toInventoryItemResponse);
  }

  @Post()
  async create(
    @Body() dto: CreateInventoryItemDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<InventoryItemResponse> {
    const context = tenantContextFromRequest(req);
    if (!context.tenantId) {
      throw new ForbiddenException("Requires a tenant-scoped session");
    }
    const tenantId = context.tenantId;
    const item = await this.prisma.withTenantContext(context, (tx) =>
      tx.inventoryItem.upsert({
        where: { tenantId_sku: { tenantId, sku: dto.sku } },
        create: {
          tenantId,
          sku: dto.sku,
          name: dto.name,
          quantityOnHand: dto.quantity_on_hand,
          reorderThreshold: dto.reorder_threshold,
        },
        update: {
          name: dto.name,
          quantityOnHand: dto.quantity_on_hand,
          reorderThreshold: dto.reorder_threshold,
        },
      }),
    );
    await this.twinService.refreshAndNotify(tenantId);
    return toInventoryItemResponse(item);
  }
}
