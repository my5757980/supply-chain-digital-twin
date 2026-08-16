import {
  createTestApp,
  onboardAndLoginOwner,
  createAndLoginStaff,
  cleanupTenant,
  seedPrediction,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: GET /audit-logs (T056)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let staffAgent: Awaited<ReturnType<typeof createAndLoginStaff>>["agent"];

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
    const staff = await createAndLoginStaff(ctx.app, tenant.tenantId);
    staffAgent = staff.agent;
    await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("an owner can access it and sees entries matching the AuditLogEntry schema", async () => {
    const res = await tenant.agent.get("/audit-logs").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      actor: expect.any(String),
      action: expect.any(String),
      entity_type: expect.any(String),
      created_at: expect.any(String),
    });
  });

  it("a staff-role user cannot access it", async () => {
    await staffAgent.get("/audit-logs").expect(403);
  });

  it("supports filtering by entity_type", async () => {
    const res = await tenant.agent
      .get("/audit-logs?entity_type=DisruptionPrediction")
      .expect(200);
    expect(
      res.body.every((e: { entity_type: string }) => e.entity_type === "DisruptionPrediction"),
    ).toBe(true);
  });
});
