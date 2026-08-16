import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: GET/POST /suppliers (T019)", () => {
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

  it("POST creates a supplier matching the Supplier schema, incl. kind", async () => {
    const res = await tenant.agent
      .post("/suppliers")
      .send({ name: "Contract Supplier", kind: "backup", typical_lead_time_days: 7, location: "Dubai" })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(String),
      name: "Contract Supplier",
      kind: "backup",
      status: "active",
      typical_lead_time_days: 7,
      location: "Dubai",
    });
  });

  it("GET lists suppliers as an array matching the schema", async () => {
    const res = await tenant.agent.get("/suppliers").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ name: expect.any(String), kind: expect.any(String) });
  });
});
