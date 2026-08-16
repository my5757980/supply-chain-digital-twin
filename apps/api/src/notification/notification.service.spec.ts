import { firstValueFrom } from "rxjs";
import { take } from "rxjs/operators";
import { NotificationService } from "./notification.service";

describe("NotificationService (T015)", () => {
  it("delivers a published event only to subscribers of the matching tenant", async () => {
    const service = new NotificationService();
    const tenantAEvent = firstValueFrom(service.streamFor("tenant-a").pipe(take(1)));

    service.publish("tenant-b", "twin.updated", { note: "not for tenant a" });
    service.publish("tenant-a", "twin.updated", { note: "for tenant a" });

    const event = await tenantAEvent;
    expect(event.type).toBe("twin.updated");
    expect(event.data).toEqual({ note: "for tenant a" });
  });
});
