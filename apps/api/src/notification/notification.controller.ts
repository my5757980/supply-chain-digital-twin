import { Controller, Sse, UseGuards, Req, type MessageEvent } from "@nestjs/common";
import { NEVER, type Observable } from "rxjs";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { NotificationService } from "./notification.service";

@Controller("events")
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Sse("stream")
  @UseGuards(AuthGuard)
  stream(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      // platform_admin sessions (tenantId null) don't have a twin/alert
      // stream to subscribe to; NEVER is an idle stream that never emits
      // or completes, rather than erroring.
      return NEVER;
    }
    return this.notifications.streamFor(tenantId);
  }
}
