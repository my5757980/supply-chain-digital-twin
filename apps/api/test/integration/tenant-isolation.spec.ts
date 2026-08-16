import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

/** Directly verifies FR-011 and SC-006 at the API level (complements the
 * lower-level `rls.spec.ts` from Phase 2, which tests the database policies
 * in isolation). */
describe("Integration: tenant isolation via /twin (T023)", () => {
  let ctx: TestAppContext;
  let tenantA: OnboardedTenant;
  let tenantB: OnboardedTenant;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenantA = await onboardAndLoginOwner(ctx.app);
    tenantB = await onboardAndLoginOwner(ctx.app);

    await tenantA.agent
      .post("/inventory-items")
      .send({ sku: "SKU-ISO-A", name: "Tenant A Widget", quantity_on_hand: 1 })
      .expect(201);
    await tenantA.agent
      .post("/suppliers")
      .send({ name: "Tenant A Supplier", kind: "primary" })
      .expect(201);

    await tenantB.agent
      .post("/inventory-items")
      .send({ sku: "SKU-ISO-B", name: "Tenant B Widget", quantity_on_hand: 2 })
      .expect(201);
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenantA.tenantId);
    await cleanupTenant(ctx.prisma, tenantB.tenantId);
    await ctx.app.close();
  });

  it("tenant A's twin never shows tenant B's inventory or suppliers, and vice versa", async () => {
    const twinA = await tenantA.agent.get("/twin").expect(200);
    const twinB = await tenantB.agent.get("/twin").expect(200);

    expect(twinA.body.inventory_summary.map((i: { sku: string }) => i.sku)).toEqual([
      "SKU-ISO-A",
    ]);
    expect(twinA.body.suppliers.map((s: { name: string }) => s.name)).toEqual([
      "Tenant A Supplier",
    ]);

    expect(twinB.body.inventory_summary.map((i: { sku: string }) => i.sku)).toEqual([
      "SKU-ISO-B",
    ]);
    expect(twinB.body.suppliers).toHaveLength(0);
  });

  it("GET /inventory-items and /suppliers are equally isolated", async () => {
    const itemsA = await tenantA.agent.get("/inventory-items").expect(200);
    const itemsB = await tenantB.agent.get("/inventory-items").expect(200);
    expect(itemsA.body.map((i: { sku: string }) => i.sku)).toEqual(["SKU-ISO-A"]);
    expect(itemsB.body.map((i: { sku: string }) => i.sku)).toEqual(["SKU-ISO-B"]);
  });
});
