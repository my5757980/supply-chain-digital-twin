import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: GET/POST /inventory-items (T018)", () => {
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

  it("POST creates an item matching the InventoryItem schema", async () => {
    const res = await tenant.agent
      .post("/inventory-items")
      .send({ sku: "SKU-CONTRACT-1", name: "Contract Widget", quantity_on_hand: 25, reorder_threshold: 5 })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(String),
      sku: "SKU-CONTRACT-1",
      name: "Contract Widget",
      quantity_on_hand: 25,
      reorder_threshold: 5,
      data_source_id: null,
      updated_at: expect.any(String),
    });
  });

  it("GET lists items as an array matching the schema", async () => {
    const res = await tenant.agent.get("/inventory-items").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ sku: expect.any(String), name: expect.any(String) });
  });
});
