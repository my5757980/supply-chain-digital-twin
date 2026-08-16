import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Guards routes meant to be called only by apps/ai-service (the callback
 * endpoints that persist predictions/recommendations). Checked against a
 * shared secret (`AI_SERVICE_TOKEN`) sent as `x-service-token`, per
 * research.md's Prediction/Action service boundary.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>("AI_SERVICE_TOKEN");
    const provided = request.header("x-service-token");
    if (!expected || provided !== expected) {
      throw new ForbiddenException("Invalid or missing service token");
    }
    return true;
  }
}
