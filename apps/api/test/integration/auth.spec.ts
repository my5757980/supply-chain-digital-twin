import request from "supertest";
import {
  createTestApp,
  onboardAndLoginOwner,
  createAndLoginStaff,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

/**
 * Uses the shared `createTestApp` helper rather than bootstrapping its own
 * app — an earlier version duplicated the bootstrap and drifted out of
 * sync with it (it was missing the global exception filter that production
 * and every other suite use), which is exactly the kind of divergence that
 * makes a suite test something other than what ships.
 */
describe("Auth session (T010)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let staff: Awaited<ReturnType<typeof createAndLoginStaff>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    tenant = await onboardAndLoginOwner(ctx.app);
    staff = await createAndLoginStaff(ctx.app, tenant.tenantId);
  });

  afterAll(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
    await ctx.app.close();
  });

  it("returns 401 for a protected route with no session", async () => {
    await request(ctx.app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("issues an owner session distinguishable from staff", async () => {
    const res = await tenant.agent.get("/auth/me").expect(200);
    expect(res.body).toMatchObject({
      id: tenant.ownerId,
      tenantId: tenant.tenantId,
      role: "owner",
    });
  });

  it("issues a staff session distinguishable from owner", async () => {
    const res = await staff.agent.get("/auth/me").expect(200);
    expect(res.body).toMatchObject({
      id: staff.staffId,
      tenantId: tenant.tenantId,
      role: "staff",
    });
  });

  it("logs out and revokes the session", async () => {
    const agent = request.agent(ctx.app.getHttpServer());
    await agent.post("/auth/dev-login").send({ userId: tenant.ownerId }).expect(200);
    await agent.post("/auth/logout").expect(204);
    await agent.get("/auth/me").expect(401);
  });
});
