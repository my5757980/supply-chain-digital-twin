import { Injectable } from "@nestjs/common";
import type { Tenant } from "@prisma/client";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export interface OnboardTenantInput {
  businessName: string;
  sector: string;
  ownerEmailOrPhone: string;
}

export interface OnboardTenantResult {
  tenant: Tenant;
  ownerUserId: string;
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * A brand-new tenant has no RLS context of its own yet, so tenant
   * creation (and the owner user created alongside it) necessarily runs
   * under an elevated (platform_admin) context — see the RLS notes in
   * prisma/migrations/20260815044501_init_foundational/migration.sql and
   * data-model.md's `Tenant` entity.
   */
  async onboard(input: OnboardTenantInput): Promise<OnboardTenantResult> {
    const tenant = await this.prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: true },
      (tx) =>
        tx.tenant.create({
          data: { businessName: input.businessName, sector: input.sector },
        }),
    );

    const owner = await this.prisma.withTenantContext(
      { tenantId: tenant.id, isPlatformAdmin: false },
      (tx) =>
        tx.user.create({
          data: {
            tenantId: tenant.id,
            emailOrPhone: input.ownerEmailOrPhone,
            role: "owner",
            name: "Owner",
          },
        }),
    );

    await this.audit.record(
      { tenantId: tenant.id, isPlatformAdmin: false },
      {
        actor: "system:onboarding",
        action: "tenant.onboarded",
        entityType: "Tenant",
        entityId: tenant.id,
        payload: { sector: input.sector },
      },
    );

    return { tenant, ownerUserId: owner.id };
  }

  /**
   * Constitution Principle V: the AI prediction/recommendation loop sends
   * this tenant's supply-chain signals to the Claude API — a third party,
   * outside the platform's boundary. That egress requires explicit, logged
   * consent, and this is the only place that consent is granted.
   *
   * Activation is deliberately coupled to it: a tenant only reaches
   * `active` once consent exists (data-model.md's `Tenant` validation
   * rule), so "active" can never mean "we're processing your data without
   * having asked".
   */
  async grantAiProcessingConsent(context: TenantContext, grantedByUserId: string): Promise<Tenant> {
    const tenantId = context.tenantId as string;
    const tenant = await this.prisma.withTenantContext(context, (tx) =>
      tx.tenant.update({
        where: { id: tenantId },
        data: { aiProcessingConsentAt: new Date(), onboardingStatus: "active" },
      }),
    );

    await this.audit.record(context, {
      actor: `user:${grantedByUserId}`,
      action: "tenant.ai_processing_consent_granted",
      entityType: "Tenant",
      entityId: tenantId,
      payload: { grantedAt: tenant.aiProcessingConsentAt?.toISOString() ?? null },
    });

    return tenant;
  }

  /** Returns false when the tenant has not consented to third-party AI
   * processing — callers MUST refuse to run/persist AI output in that case. */
  async hasAiProcessingConsent(context: TenantContext): Promise<boolean> {
    const tenantId = context.tenantId as string;
    const tenant = await this.prisma.withTenantContext(context, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { aiProcessingConsentAt: true },
      }),
    );
    return tenant?.aiProcessingConsentAt != null;
  }
}
