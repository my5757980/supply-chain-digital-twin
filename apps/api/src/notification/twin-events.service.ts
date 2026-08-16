import { Injectable } from "@nestjs/common";
import { NotificationService } from "./notification.service";

/** Thin, named wrapper so producers (ingestion, twin) don't need to know
 * the SSE event-type string in more than one place. */
@Injectable()
export class TwinEventsService {
  constructor(private readonly notifications: NotificationService) {}

  publishTwinUpdated(tenantId: string, snapshot: object): void {
    this.notifications.publish(tenantId, "twin.updated", snapshot);
  }
}
