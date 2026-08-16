import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  seedPrediction,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

/** Covers spec.md User Story 2 Acceptance Scenario 3 and FR-012. */
describe("Integration: false-positive predictions stay visible in history (T041)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let falsePositiveId: string;
  let truePositiveId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);

    const falsePositive = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    falsePositiveId = falsePositive.predictionId;
    const truePositive = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    truePositiveId = truePositive.predictionId;

    // Simulates the predicted window having passed and the outcome being
    // resolved (data-model.md's DisruptionPrediction state transitions) —
    // no dedicated resolution endpoint exists yet, so this reflects what a
    // future outcome-resolution job would do.
    await ctx.prisma.withTenantContext(
      { tenantId: tenant.tenantId, isPlatformAdmin: false },
      async (tx) => {
        await tx.disruptionPrediction.update({
          where: { id: falsePositiveId },
          data: { status: "resolved_false_positive" },
        });
        await tx.disruptionPrediction.update({
          where: { id: truePositiveId },
          data: { status: "resolved_true_positive" },
        });
      },
    );
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("a false-positive prediction remains retrievable rather than hidden", async () => {
    const res = await tenant.agent.get(`/predictions/${falsePositiveId}`).expect(200);
    expect(res.body.status).toBe("resolved_false_positive");
  });

  it("the full history (incl. false positives) is visible via GET /predictions", async () => {
    const res = await tenant.agent.get("/predictions").expect(200);
    const ids = res.body.map((p: { id: string }) => p.id);
    expect(ids).toEqual(expect.arrayContaining([falsePositiveId, truePositiveId]));
  });

  it("status filtering distinguishes false positives from true positives", async () => {
    const falsePositives = await tenant.agent
      .get("/predictions?status=resolved_false_positive")
      .expect(200);
    expect(falsePositives.body.map((p: { id: string }) => p.id)).toEqual([falsePositiveId]);

    const truePositives = await tenant.agent
      .get("/predictions?status=resolved_true_positive")
      .expect(200);
    expect(truePositives.body.map((p: { id: string }) => p.id)).toEqual([truePositiveId]);
  });
});
