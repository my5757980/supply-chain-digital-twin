import request from "supertest";
import { createTestApp, cleanupTenant, type TestAppContext } from "../helpers/test-app";

describe("Contract: POST /tenants (T016)", () => {
  let ctx: TestAppContext;
  let createdTenantId: string | undefined;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    if (createdTenantId) {
      await cleanupTenant(ctx.prisma, createdTenantId);
    }
    await ctx.app.close();
  });

  it("returns 201 with a Tenant matching the contract schema", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/tenants")
      .send({
        business_name: "Contract Test Co",
        sector: "retail",
        owner_email_or_phone: `contract-${Date.now()}@test.co`,
      })
      .expect(201);

    createdTenantId = res.body.id;
    expect(res.body).toMatchObject({
      id: expect.any(String),
      business_name: "Contract Test Co",
      sector: "retail",
      country: "AE",
      onboarding_status: "pending",
    });
  });

  it("returns 400 when a required field is missing", async () => {
    await request(ctx.app.getHttpServer())
      .post("/tenants")
      .send({ business_name: "Missing Fields Co" })
      .expect(400);
  });
});
