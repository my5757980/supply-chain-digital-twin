import {
  createTestApp,
  onboardAndLoginOwner,
  createAndLoginStaff,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: GET/POST /auto-trigger-rules (T055)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let staffAgent: Awaited<ReturnType<typeof createAndLoginStaff>>["agent"];

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
    const staff = await createAndLoginStaff(ctx.app, tenant.tenantId);
    staffAgent = staff.agent;
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("an owner-role request to POST returns 201", async () => {
    const res = await tenant.agent
      .post("/auto-trigger-rules")
      .send({ enabled: true, conditions: { min_confidence: 0.9 } })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(String),
      enabled: true,
      created_by_user_id: tenant.ownerId,
    });
  });

  it("a staff-role request to POST returns 403", async () => {
    await staffAgent
      .post("/auto-trigger-rules")
      .send({ enabled: true })
      .expect(403);
  });

  it("an owner-role request to GET returns the tenant's rules", async () => {
    const res = await tenant.agent.get("/auto-trigger-rules").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("a staff-role request to GET also returns 403 (owner-only feature)", async () => {
    await staffAgent.get("/auto-trigger-rules").expect(403);
  });
});
