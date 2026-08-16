import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  seedPrediction,
  seedRecommendation,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

/**
 * Covers FR-005: opt-in auto-triggering. Each test onboards its own tenant
 * — AutoTriggerRule state must not leak between cases (rules created by
 * one test would otherwise silently match another test's predictions).
 */
describe("Integration: opt-in auto-trigger (T060)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    tenant = await onboardAndLoginOwner(ctx.app);
  });

  afterEach(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("a matching enabled rule auto-triggers the recommendation and is audit-logged", async () => {
    await tenant.agent
      .post("/auto-trigger-rules")
      .send({ enabled: true, conditions: { min_confidence: 0.5 } })
      .expect(201);

    const { alertId } = await seedPrediction(ctx.app, {
      tenantId: tenant.tenantId,
      confidenceScore: 0.8,
    });
    const { recommendationId, ownerDecision, autoTriggered } = await seedRecommendation(ctx.app, {
      tenantId: tenant.tenantId,
      alertId,
    });

    expect(autoTriggered).toBe(true);
    expect(ownerDecision).toBe("accepted");

    const auditRes = await tenant.agent
      .get("/audit-logs?entity_type=Recommendation")
      .expect(200);
    const autoTriggerEntries = auditRes.body.filter(
      (e: { entity_id: string; action: string }) =>
        e.entity_id === recommendationId && e.action === "recommendation.auto_triggered",
    );
    expect(autoTriggerEntries).toHaveLength(1);
  });

  it("does not auto-trigger when no rule's conditions match", async () => {
    await tenant.agent
      .post("/auto-trigger-rules")
      .send({ enabled: true, conditions: { min_confidence: 0.99 } })
      .expect(201);

    const { alertId } = await seedPrediction(ctx.app, {
      tenantId: tenant.tenantId,
      confidenceScore: 0.6,
    });
    const { ownerDecision, autoTriggered } = await seedRecommendation(ctx.app, {
      tenantId: tenant.tenantId,
      alertId,
    });

    expect(autoTriggered).toBe(false);
    expect(ownerDecision).toBe("pending");
  });

  it("does not auto-trigger when the only matching rule is disabled", async () => {
    const ruleRes = await tenant.agent
      .post("/auto-trigger-rules")
      .send({ enabled: false, conditions: { min_confidence: 0.1 } })
      .expect(201);
    expect(ruleRes.body.enabled).toBe(false);

    const { alertId } = await seedPrediction(ctx.app, {
      tenantId: tenant.tenantId,
      confidenceScore: 0.95,
    });
    const { ownerDecision, autoTriggered } = await seedRecommendation(ctx.app, {
      tenantId: tenant.tenantId,
      alertId,
    });

    expect(autoTriggered).toBe(false);
    expect(ownerDecision).toBe("pending");
  });
});
