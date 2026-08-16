import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  seedPrediction,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: GET /alerts, GET /alerts/{id} (T038)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let lowSeverityAlertId: string;
  let criticalAlertId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
    const low = await seedPrediction(ctx.app, { tenantId: tenant.tenantId, confidenceScore: 0.3 });
    lowSeverityAlertId = low.alertId;
    const critical = await seedPrediction(ctx.app, {
      tenantId: tenant.tenantId,
      confidenceScore: 0.95,
    });
    criticalAlertId = critical.alertId;
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("GET /alerts returns a list matching the Alert schema, ordered severity desc", async () => {
    const res = await tenant.agent.get("/alerts").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      severity: expect.any(String),
      status: "new",
      title: expect.any(String),
      summary: expect.any(String),
    });
    expect(res.body[0].id).toBe(criticalAlertId);
    expect(res.body[0].severity).toBe("critical");
    expect(res.body[res.body.length - 1].id).toBe(lowSeverityAlertId);
    expect(res.body[res.body.length - 1].severity).toBe("low");
  });

  it("GET /alerts?status= filters correctly", async () => {
    const res = await tenant.agent.get("/alerts?status=new").expect(200);
    expect(res.body.every((a: { status: string }) => a.status === "new")).toBe(true);
  });

  it("GET /alerts/:id returns an AlertDetail with the nested prediction", async () => {
    const res = await tenant.agent.get(`/alerts/${criticalAlertId}`).expect(200);
    expect(res.body.id).toBe(criticalAlertId);
    expect(res.body.prediction).toMatchObject({ id: expect.any(String), type: "supplier_delay" });
    expect(res.body.recommendation).toBeNull();
  });

  it("GET /alerts/:id returns 404 for an unknown id", async () => {
    await tenant.agent.get("/alerts/00000000-0000-0000-0000-000000000000").expect(404);
  });
});
