import request from "supertest";
import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

describe("Contract: POST /data-sources/csv-upload (T017)", () => {
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

  it("returns 202 with {data_source_id, status: processing} for a valid upload", async () => {
    const csv = "sku,name,quantity_on_hand\nSKU-1,Widget,10\n";
    const res = await tenant.agent
      .post("/data-sources/csv-upload")
      .field("data_type", "inventory")
      .attach("file", Buffer.from(csv), "inventory.csv")
      .expect(202);

    expect(res.body).toMatchObject({
      data_source_id: expect.any(String),
      status: "processing",
    });
  });

  it("returns 401 without an authenticated session", async () => {
    const csv = "sku,name,quantity_on_hand\nSKU-1,Widget,10\n";
    await request(ctx.app.getHttpServer())
      .post("/data-sources/csv-upload")
      .field("data_type", "inventory")
      .attach("file", Buffer.from(csv), "inventory.csv")
      .expect(401);
  });
});
