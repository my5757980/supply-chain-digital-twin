import type { TenantContext } from "../common/prisma/prisma.service";
import type { AuthenticatedRequest } from "./auth.guard";

/** Requires `AuthGuard` to have already run (throws otherwise). */
export function tenantContextFromRequest(req: AuthenticatedRequest): TenantContext {
  const user = req.session.user;
  if (!user) {
    throw new Error("tenantContextFromRequest called on an unauthenticated request");
  }
  return { tenantId: user.tenantId, isPlatformAdmin: user.role === "platform_admin" };
}
