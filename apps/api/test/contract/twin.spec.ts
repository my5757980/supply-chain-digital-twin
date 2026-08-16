import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: GET /twin (T020)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
    await tenant.agent
      .post("/inventory-items")
      .send({ sku: "SKU-TWIN-1", name: "Twin Widget", quantity_on_hand: 3 })
      .expect(201);
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("returns a TwinSnapshot matching the contract schema", async () => {
    const res = await tenant.agent.get("/twin").expect(200);
    expect(res.body).toMatchObject({
      tenant_id: tenant.tenantId,
      computed_at: expect.any(String),
      inventory_summary: expect.any(Array),
      suppliers: expect.any(Array),
      open_orders_count: expect.any(Number),
      stale_data_warnings: expect.any(Array),
    });
    expect(res.body.inventory_summary.some((i: { sku: string }) => i.sku === "SKU-TWIN-1")).toBe(
      true,
    );
  });
});
