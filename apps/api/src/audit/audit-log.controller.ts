import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { Roles } from "../identity/roles.decorator";
import { RolesGuard } from "../identity/roles.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { AuditService } from "./audit.service";
import { toAuditLogEntryResponse, type AuditLogEntryResponse } from "./audit.mapper";

@Controller("audit-logs")
@UseGuards(AuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles("owner", "platform_admin")
  async list(
    @Req() req: AuthenticatedRequest,
    @Query("entity_type") entityType?: string,
  ): Promise<AuditLogEntryResponse[]> {
    const context = tenantContextFromRequest(req);
    const entries = await this.auditService.list(context, entityType);
    return entries.map(toAuditLogEntryResponse);
  }
}
