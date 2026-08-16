import { Injectable, type MessageEvent } from "@nestjs/common";
import { Subject } from "rxjs";
import { filter, map } from "rxjs/operators";
import type { Observable } from "rxjs";

interface TenantEvent {
  tenantId: string;
  type: string;
  data: string | object;
}

/**
 * In-process SSE fan-out scaffold (T015). No producers are wired to this
 * yet — `twin.updated` (T034) and `alert.created`/`alert.escalated`
 * (T050/T051) will call `publish` once those stories land. Chosen over
 * WebSockets per research.md §3 (one-directional server→client push only).
 */
@Injectable()
export class NotificationService {
  private readonly events$ = new Subject<TenantEvent>();

  publish(tenantId: string, type: string, data: string | object): void {
    this.events$.next({ tenantId, type, data });
  }

  streamFor(tenantId: string): Observable<MessageEvent> {
    return this.events$.pipe(
      filter((event) => event.tenantId === tenantId),
      map((event) => ({ type: event.type, data: event.data })),
    );
  }
}
