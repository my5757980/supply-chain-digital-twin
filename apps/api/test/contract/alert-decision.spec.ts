import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  seedPrediction,
  seedRecommendation,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: POST /alerts/{id}/decision (T054)", () => {
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

  it("accepts a decision of 'accepted' without requiring modification_notes", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    await seedRecommendation(ctx.app, { tenantId: tenant.tenantId, alertId });

    const res = await tenant.agent
      .post(`/alerts/${alertId}/decision`)
      .send({ decision: "accepted" })
      .expect(201);

    expect(res.body.owner_decision).toBe("accepted");
  });

  it("accepts a decision of 'dismissed'", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    await seedRecommendation(ctx.app, { tenantId: tenant.tenantId, alertId });

    const res = await tenant.agent
      .post(`/alerts/${alertId}/decision`)
      .send({ decision: "dismissed" })
      .expect(201);

    expect(res.body.owner_decision).toBe("dismissed");
  });

  it("rejects a decision of 'modified' without modification_notes", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    await seedRecommendation(ctx.app, { tenantId: tenant.tenantId, alertId });

    await tenant.agent.post(`/alerts/${alertId}/decision`).send({ decision: "modified" }).expect(400);
  });

  it("accepts a decision of 'modified' with modification_notes", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    await seedRecommendation(ctx.app, { tenantId: tenant.tenantId, alertId });

    const res = await tenant.agent
      .post(`/alerts/${alertId}/decision`)
      .send({ decision: "modified", modification_notes: "Using a different supplier instead." })
      .expect(201);

    expect(res.body.owner_decision).toBe("modified");
  });

  it("returns 404 when the alert has no recommendation yet", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });

    await tenant.agent.post(`/alerts/${alertId}/decision`).send({ decision: "accepted" }).expect(404);
  });
});
