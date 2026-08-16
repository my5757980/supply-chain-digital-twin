import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { TwinService, type TwinSnapshot } from "./twin.service";

@Controller("twin")
@UseGuards(AuthGuard)
export class TwinController {
  constructor(private readonly twinService: TwinService) {}

  @Get()
  async getTwin(@Req() req: AuthenticatedRequest): Promise<TwinSnapshot> {
    return this.twinService.getSnapshot(tenantContextFromRequest(req));
  }
}
