import { Controller, Get, UseGuards } from "@nestjs/common";
import { ServiceTokenGuard } from "./service-token.guard";

/**
 * Base for internal, service-to-service-only endpoints (extended by the
 * AI-service prediction/recommendation callbacks in US2/US3, T046/T066).
 */
@Controller("internal")
@UseGuards(ServiceTokenGuard)
export class InternalController {
  @Get("ping")
  ping(): { status: "ok" } {
    return { status: "ok" };
  }
}
