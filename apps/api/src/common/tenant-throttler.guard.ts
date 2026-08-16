import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import type { SessionUser } from "../identity/session.types";

/**
 * Rate limits per tenant rather than per IP (T073). Several staff of one
 * SME often share an office IP, and conversely one abusive tenant can
 * rotate IPs — the tenant is the meaningful unit here. Unauthenticated
 * requests (onboarding, login) have no tenant yet, so those fall back to
 * IP, which is the correct unit for signup abuse.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const user = (req as Request & { session?: { user?: SessionUser } }).session?.user;
    if (user?.tenantId) {
      return `tenant:${user.tenantId}`;
    }
    return `ip:${req.ip ?? "unknown"}`;
  }
}
