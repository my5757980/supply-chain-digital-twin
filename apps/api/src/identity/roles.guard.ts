import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";
import type { UserRole } from "./session.types";
import type { AuthenticatedRequest } from "./auth.guard";

/** Must run after `AuthGuard` (relies on `request.session.user` existing). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.session?.user?.role;
    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(`Requires role: ${requiredRoles.join(" or ")}`);
    }
    return true;
  }
}
