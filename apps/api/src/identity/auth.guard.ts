import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { SessionUser } from "./session.types";

export interface AuthenticatedRequest extends Request {
  session: Request["session"] & { user?: SessionUser };
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.session?.user) {
      throw new UnauthorizedException("No active session");
    }
    return true;
  }
}
