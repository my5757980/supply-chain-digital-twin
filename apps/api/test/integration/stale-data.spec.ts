import { FreshnessCheckerService } from "../../src/ingestion/freshness-checker.service";
import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

async function waitFor(check: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("waitFor: condition not met within timeout");
}

/** Covers spec.md User Story 1 Acceptance Scenario 3 and the "connected
 * data source stops updating" Edge Case (FR-013). */
describe("Integration: stale-data flagging (T022)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let dataSourceId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);

    const csv = "sku,name,quantity_on_hand\nSKU-STALE-1,Stale Widget,7\n";
    const uploadRes = await tenant.agent
      .post("/data-sources/csv-upload")
      .field("data_type", "inventory")
      .attach("file", Buffer.from(csv), "inventory.csv")
      .expect(202);
    dataSourceId = uploadRes.body.data_source_id;

    // Wait for the async worker (T029) to actually ingest before continuing.
    await waitFor(async () => {
      const item = await ctx.prisma.withTenantContext(
        { tenantId: tenant.tenantId, isPlatformAdmin: false },
        (tx) => tx.inventoryItem.findFirst({ where: { sku: "SKU-STALE-1" } }),
      );
      return item !== null;
    });
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("flags a data source as stale once past the freshness threshold, and the twin surfaces it", async () => {
    // Simulate the passage of time rather than waiting on the real clock:
    // backdate last_synced_at well past any reasonable threshold.
    await ctx.prisma.withTenantContext({ tenantId: null, isPlatformAdmin: true }, (tx) =>
      tx.dataSource.update({
        where: { id: dataSourceId },
        data: { lastSyncedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    );

    const freshnessChecker = ctx.app.get(FreshnessCheckerService);
    const flaggedCount = await freshnessChecker.runOnce();
    expect(flaggedCount).toBeGreaterThanOrEqual(1);

    const dataSource = await ctx.prisma.withTenantContext(
      { tenantId: tenant.tenantId, isPlatformAdmin: false },
      (tx) => tx.dataSource.findUniqueOrThrow({ where: { id: dataSourceId } }),
    );
    expect(dataSource.status).toBe("stale");

    const twin = await tenant.agent.get("/twin").expect(200);
    expect(
      twin.body.stale_data_warnings.some(
        (w: { data_source_id: string }) => w.data_source_id === dataSourceId,
      ),
    ).toBe(true);
  });
});
