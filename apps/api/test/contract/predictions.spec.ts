import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  seedPrediction,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: GET /predictions, GET /predictions/{id} (T037)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let predictionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
    const seeded = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    predictionId = seeded.predictionId;
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("GET /predictions returns a list matching the DisruptionPrediction schema", async () => {
    const res = await tenant.agent.get("/predictions").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      type: "supplier_delay",
      confidence_score: expect.any(Number),
      predicted_impact_at: expect.any(String),
      status: "active",
      created_by_agent: expect.any(String),
      created_at: expect.any(String),
    });
  });

  it("GET /predictions?status= filters correctly", async () => {
    const res = await tenant.agent.get("/predictions?status=active").expect(200);
    expect(res.body.every((p: { status: string }) => p.status === "active")).toBe(true);
    const noneRes = await tenant.agent.get("/predictions?status=expired").expect(200);
    expect(noneRes.body).toHaveLength(0);
  });

  it("GET /predictions/:id returns a single prediction", async () => {
    const res = await tenant.agent.get(`/predictions/${predictionId}`).expect(200);
    expect(res.body.id).toBe(predictionId);
  });

  it("GET /predictions/:id returns 404 for an unknown id", async () => {
    await tenant.agent.get("/predictions/00000000-0000-0000-0000-000000000000").expect(404);
  });
});
