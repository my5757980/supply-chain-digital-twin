import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  seedPrediction,
  seedRecommendation,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

/** Covers spec.md User Story 3 Acceptance Scenario 2. */
describe("Integration: decision recording + audit log (T059)", () => {
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

  it("recording a decision produces exactly one AuditLogEntry referencing the Recommendation", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    const { recommendationId } = await seedRecommendation(ctx.app, {
      tenantId: tenant.tenantId,
      alertId,
    });

    await tenant.agent
      .post(`/alerts/${alertId}/decision`)
      .send({ decision: "accepted" })
      .expect(201);

    const auditRes = await tenant.agent
      .get("/audit-logs?entity_type=Recommendation")
      .expect(200);
    const decisionEntries = auditRes.body.filter(
      (e: { entity_id: string; action: string }) =>
        e.entity_id === recommendationId && e.action === "recommendation.decision_recorded",
    );
    expect(decisionEntries).toHaveLength(1);
  });

  it("the alert's status reflects the decision", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    await seedRecommendation(ctx.app, { tenantId: tenant.tenantId, alertId });

    await tenant.agent
      .post(`/alerts/${alertId}/decision`)
      .send({ decision: "dismissed" })
      .expect(201);

    const alert = await tenant.agent.get(`/alerts/${alertId}`).expect(200);
    expect(alert.body.status).toBe("dismissed");
    expect(alert.body.recommendation.owner_decision).toBe("dismissed");
  });
});
