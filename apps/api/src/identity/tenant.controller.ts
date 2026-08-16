import { Body, Controller, ForbiddenException, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { toTenantResponse, type TenantResponse } from "./tenant.mapper";
import { AuthGuard, type AuthenticatedRequest } from "./auth.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { tenantContextFromRequest } from "./tenant-context.util";

export interface AiConsentResponse {
  tenant_id: string;
  onboarding_status: string;
  ai_processing_consent_at: string | null;
}

@Controller("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateTenantDto): Promise<TenantResponse> {
    const { tenant, ownerUserId } = await this.tenantService.onboard({
      businessName: dto.business_name,
      sector: dto.sector,
      ownerEmailOrPhone: dto.owner_email_or_phone,
    });
    return toTenantResponse(tenant, ownerUserId);
  }

  /**
   * Constitution Principle V: explicit, logged consent before any of this
   * tenant's data is sent to the Claude API. Owner-only — consenting to
   * third-party processing of the business's commercial data is not a
   * staff-level decision.
   */
  @Post("me/ai-consent")
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("owner")
  async grantAiConsent(@Req() req: AuthenticatedRequest): Promise<AiConsentResponse> {
    const context = tenantContextFromRequest(req);
    if (!context.tenantId) {
      throw new ForbiddenException("Requires a tenant-scoped session");
    }
    const userId = (req.session.user as { id: string }).id;
    const tenant = await this.tenantService.grantAiProcessingConsent(context, userId);
    return {
      tenant_id: tenant.id,
      onboarding_status: tenant.onboardingStatus,
      ai_processing_consent_at: tenant.aiProcessingConsentAt?.toISOString() ?? null,
    };
  }
}
