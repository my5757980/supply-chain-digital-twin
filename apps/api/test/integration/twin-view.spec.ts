import { firstValueFrom } from "rxjs";
import { take, timeout } from "rxjs/operators";
import { NotificationService } from "../../src/notification/notification.service";
import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

/** Covers spec.md User Story 1 Acceptance Scenarios 1 and 2. */
describe("Integration: onboard → connect data → twin reflects it (T021)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("Scenario 1: twin shows inventory, orders, suppliers, logistics in one place", async () => {
    await tenant.agent
      .post("/suppliers")
      .send({ name: "Primary Supplier", kind: "primary" })
      .expect(201);
    await tenant.agent
      .post("/inventory-items")
      .send({ sku: "SKU-VIEW-1", name: "Viewable Widget", quantity_on_hand: 12 })
      .expect(201);

    const twin = await tenant.agent.get("/twin").expect(200);
    expect(twin.body.suppliers.some((s: { name: string }) => s.name === "Primary Supplier")).toBe(
      true,
    );
    expect(
      twin.body.inventory_summary.some((i: { sku: string }) => i.sku === "SKU-VIEW-1"),
    ).toBe(true);
    expect(twin.body.open_orders_count).toBe(0);
  });

  it("Scenario 2: twin reflects a change without the owner manually refreshing/re-entering", async () => {
    const notifications = ctx.app.get(NotificationService);
    const nextEvent = firstValueFrom(
      notifications.streamFor(tenant.tenantId).pipe(take(1), timeout(5000)),
    );

    await tenant.agent
      .post("/inventory-items")
      .send({ sku: "SKU-VIEW-2", name: "Second Widget", quantity_on_hand: 4 })
      .expect(201);

    const event = await nextEvent;
    expect(event.type).toBe("twin.updated");

    // The owner never re-fetches manually in the real UI (SSE pushes the
    // update); here we assert the read path already reflects it too, since
    // TwinService invalidates its cache synchronously on write.
    const twin = await tenant.agent.get("/twin").expect(200);
    expect(
      twin.body.inventory_summary.some((i: { sku: string }) => i.sku === "SKU-VIEW-2"),
    ).toBe(true);
  });
});
