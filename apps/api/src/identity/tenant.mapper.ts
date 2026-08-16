import type { Tenant } from "@prisma/client";

/**
 * Matches `contracts/api.yaml`'s `Tenant` schema, plus `owner_user_id`.
 *
 * `owner_user_id` is a deliberate extension beyond the original contract:
 * the onboarding UI needs it to bootstrap a session via the dev-login shim
 * (see auth.controller.ts). Once a real managed auth provider replaces that
 * shim (research.md §6), the provider's own post-signup flow issues the
 * session directly and this field stops being needed — it's safe to drop
 * then, not a permanent public contract commitment.
 */
export interface TenantResponse {
  id: string;
  business_name: string;
  sector: string;
  country: string;
  onboarding_status: string;
  owner_user_id: string;
}

export function toTenantResponse(tenant: Tenant, ownerUserId: string): TenantResponse {
  return {
    id: tenant.id,
    business_name: tenant.businessName,
    sector: tenant.sector,
    country: tenant.country,
    onboarding_status: tenant.onboardingStatus,
    owner_user_id: ownerUserId,
  };
}
