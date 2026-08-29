import request from "supertest";
import { createTestApp, cleanupTenant, type TestAppContext } from "../helpers/test-app";

/**
 * Covers the two ways a session can be established once `/auth/dev-login`
 * is switched off, which is what happens the moment this is hosted.
 *
 * Both paths exist because the deployed build previously had none: signup
 * called dev-login to get its session, dev-login refuses to run in
 * production, and so a hosted deployment could not be signed into at all.
 */
describe("Session paths that survive production", () => {
  let ctx: TestAppContext;
  const createdTenants: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    for (const id of createdTenants) {
      await cleanupTenant(ctx.prisma, id);
    }
    await ctx.app.close();
  });

  describe("signing up", () => {
    it("signs the new owner in, with no second request and no id from the client", async () => {
      const agent = request.agent(ctx.app.getHttpServer());

      const signup = await agent
        .post("/tenants")
        .send({
          business_name: "Session On Signup Co",
          sector: "food",
          owner_email_or_phone: "owner@session-on-signup.test",
        })
        .expect(201);
      createdTenants.push(signup.body.id);

      // The same agent is now authenticated — no /auth/dev-login in between.
      const me = await agent.get("/auth/me").expect(200);
      expect(me.body).toMatchObject({
        id: signup.body.owner_user_id,
        tenantId: signup.body.id,
        role: "owner",
      });
    });

    it("scopes the session to the tenant just created, not to any other", async () => {
      const first = request.agent(ctx.app.getHttpServer());
      const second = request.agent(ctx.app.getHttpServer());

      const a = await first
        .post("/tenants")
        .send({
          business_name: "Isolation A",
          sector: "retail",
          owner_email_or_phone: "a@isolation.test",
        })
        .expect(201);
      const b = await second
        .post("/tenants")
        .send({
          business_name: "Isolation B",
          sector: "retail",
          owner_email_or_phone: "b@isolation.test",
        })
        .expect(201);
      createdTenants.push(a.body.id, b.body.id);

      const meA = await first.get("/auth/me").expect(200);
      expect(meA.body.tenantId).toBe(a.body.id);
      expect(meA.body.tenantId).not.toBe(b.body.id);
    });
  });

  describe("the demonstration account", () => {
    const original = process.env.DEMO_OWNER_USER_ID;

    afterEach(() => {
      if (original === undefined) {
        delete process.env.DEMO_OWNER_USER_ID;
      } else {
        process.env.DEMO_OWNER_USER_ID = original;
      }
    });

    it("is refused when no demonstration account is configured", async () => {
      delete process.env.DEMO_OWNER_USER_ID;
      await request(ctx.app.getHttpServer()).post("/auth/demo-login").expect(403);
    });

    it("ignores any id the caller sends and uses only the configured account", async () => {
      const agent = request.agent(ctx.app.getHttpServer());
      const demo = await agent
        .post("/tenants")
        .send({
          business_name: "Demo Tenant",
          sector: "food",
          owner_email_or_phone: "owner@demo-tenant.test",
        })
        .expect(201);
      const other = await request(ctx.app.getHttpServer())
        .post("/tenants")
        .send({
          business_name: "Somebody Else",
          sector: "food",
          owner_email_or_phone: "owner@somebody-else.test",
        })
        .expect(201);
      createdTenants.push(demo.body.id, other.body.id);

      process.env.DEMO_OWNER_USER_ID = demo.body.owner_user_id;

      const visitor = request.agent(ctx.app.getHttpServer());
      // A caller trying to smuggle in a different owner id gets the demo
      // account anyway — the endpoint reads no input at all.
      const res = await visitor
        .post("/auth/demo-login")
        .send({ userId: other.body.owner_user_id })
        .expect(200);

      expect(res.body.id).toBe(demo.body.owner_user_id);
      expect(res.body.id).not.toBe(other.body.owner_user_id);

      const me = await visitor.get("/auth/me").expect(200);
      expect(me.body.tenantId).toBe(demo.body.id);
    });
  });
});
