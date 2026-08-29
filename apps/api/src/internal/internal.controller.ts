import { Controller, Get, UseGuards } from "@nestjs/common";
import { ServiceTokenGuard } from "./service-token.guard";
import { SweepCandidatesService, type SweepCandidate } from "./sweep-candidates.service";

/**
 * Base for internal, service-to-service-only endpoints (extended by the
 * AI-service prediction/recommendation callbacks in US2/US3, T046/T066).
 */
@Controller("internal")
@UseGuards(ServiceTokenGuard)
export class InternalController {
  constructor(private readonly sweepCandidates: SweepCandidatesService) {}

  @Get("ping")
  ping(): { status: "ok" } {
    return { status: "ok" };
  }

  /**
   * The work list apps/ai-service pulls on its sweep. Read-only, and it
   * decides nothing: the Prediction Agent still judges every candidate and
   * still refuses anything it cannot warn about 48 hours ahead.
   */
  @Get("sweep-candidates")
  async listSweepCandidates(): Promise<{ candidates: SweepCandidate[] }> {
    return { candidates: await this.sweepCandidates.listCandidates() };
  }
}
