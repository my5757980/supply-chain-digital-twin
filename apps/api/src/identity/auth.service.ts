import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import type { SessionUser } from "./session.types";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Looks up a user by id across tenants. Authenticating a request
   * necessarily happens before the caller's tenant context is known, so
   * this bootstrap lookup runs with an elevated (platform_admin) RLS
   * context; every subsequent request in the session is scoped normally via
   * `withTenantContext({ tenantId: user.tenantId, ... })`.
   */
  async findSessionUserById(userId: string): Promise<SessionUser> {
    const user = await this.prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: true },
      (tx) => tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return { id: user.id, tenantId: user.tenantId, role: user.role };
  }
}
