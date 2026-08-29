import request from "supertest";
import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

const SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN ?? "dev-only-shared-token-change-me";

/**
 * The work list the prediction service pulls on each sweep.
 *
 * The rules asserted here are the ones that decide whether an unattended
 * sweep is safe to leave running: it must never surface a business that has
 * not consented to AI processing, and it must not re-raise a warning for a
 * supplier that already has one open — a sweep that did would produce a new
 * alert every pass and teach owners to ignore the channel entirely.
 */
describe("Sweep candidates", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;

  const listCandidates = () =>
    request(ctx.app.getHttpServer())
      .get("/internal/sweep-candidates")
      .set("x-service-token", SERVICE_TOKEN);

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("refuses callers without the service token", async () => {
    await request(ctx.app.getHttpServer()).get("/internal/sweep-candidates").expect(403);
  });

  it("never offers a business that has not consented to AI processing", async () => {
    // Principle V: appearing on this list is what causes a business's data
    // to reach a model, so consent has to gate the list itself — not just
    // the callbacks further down the pipeline.
    const withheld = await onboardAndLoginOwner(ctx.app, { grantAiConsent: false });
    try {
      await withheld.agent
        .post("/suppliers")
        .send({ name: "No Consent Co", kind: "primary", typical_lead_time_days: 4 })
        .expect(201);
      await withheld.agent
        .post("/inventory-items")
        .send({ sku: "NC-1", name: "Low Item", quantity_on_hand: 1, reorder_threshold: 10 })
        .expect(201);

      const res = await listCandidates().expect(200);
      expect(
        res.body.candidates.some(
          (c: { tenant_id: string }) => c.tenant_id === withheld.tenantId,
        ),
      ).toBe(false);
    } finally {
      await cleanupTenant(ctx.prisma, withheld.tenantId);
    }
  });

  it("offers nothing for a business with no supplier and no stock", async () => {
    const res = await listCandidates().expect(200);
    expect(res.body.candidates.some((c: { tenant_id: string }) => c.tenant_id === tenant.tenantId))
      .toBe(false);
  });

  describe("once the business has a main supplier and stock below its reorder level", () => {
    beforeAll(async () => {
      await tenant.agent
        .post("/suppliers")
        .send({ name: "Sweep Main", kind: "primary", location: "Dubai", typical_lead_time_days: 4 })
        .expect(201);
      await tenant.agent
        .post("/inventory-items")
        .send({ sku: "SWEEP-1", name: "Sweep Item", quantity_on_hand: 2, reorder_threshold: 10 })
        .expect(201);
    });

    it("includes it, with the at-risk item and a lead time from the supplier", async () => {
      const res = await listCandidates().expect(200);
      const mine = res.body.candidates.find(
        (c: { tenant_id: string }) => c.tenant_id === tenant.tenantId,
      );
      expect(mine).toBeDefined();
      expect(mine.supplier_name).toBe("Sweep Main");
      expect(mine.affected_inventory_item_ids).toHaveLength(1);
      expect(mine.lead_time_hours).toBe(96); // 4 days
    });

    it("drops it again while a prediction for that supplier is still open", async () => {
      const before = await listCandidates().expect(200);
      const mine = before.body.candidates.find(
        (c: { tenant_id: string }) => c.tenant_id === tenant.tenantId,
      );

      await request(ctx.app.getHttpServer())
        .post("/internal/predictions")
        .set("x-service-token", SERVICE_TOKEN)
        .send({
          tenant_id: tenant.tenantId,
          type: "supplier_delay",
          affected_supplier_id: mine.supplier_id,
          affected_inventory_item_ids: mine.affected_inventory_item_ids,
          confidence_score: 0.9,
          predicted_impact_at: new Date(Date.now() + 96 * 3600 * 1000).toISOString(),
          created_by_agent: "prediction-agent",
          rationale: "Open prediction for the duplicate-suppression check.",
        })
        .expect(201);

      const after = await listCandidates().expect(200);
      expect(
        after.body.candidates.some(
          (c: { tenant_id: string }) => c.tenant_id === tenant.tenantId,
        ),
      ).toBe(false);
    });
  });
});
