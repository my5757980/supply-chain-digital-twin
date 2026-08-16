import { ConfigService } from "@nestjs/config";
import request from "supertest";
import {
  createTestApp,
  onboardAndLoginOwner,
  cleanupTenant,
  seedPrediction,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

const JARGON_WORDS = ["confidence score", "algorithm", "ml model", "inference", "regression"];

/** Covers spec.md User Story 2 Acceptance Scenarios 1 and 2. */
describe("Integration: simulated supplier-delay scenario produces an alert ≥48h ahead (T040)", () => {
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

  it("generates a prediction and alert with ≥48h lead time and plain-language content", async () => {
    const beforeCall = Date.now();
    const { predictionId, alertId } = await seedPrediction(ctx.app, {
      tenantId: tenant.tenantId,
      leadTimeHours: 72,
      rationale: "Your supplier has missed its last three delivery windows.",
    });

    const prediction = await tenant.agent.get(`/predictions/${predictionId}`).expect(200);
    const leadTimeMs =
      new Date(prediction.body.predicted_impact_at).getTime() - beforeCall;
    expect(leadTimeMs).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000);

    const alert = await tenant.agent.get(`/alerts/${alertId}`).expect(200);
    expect(alert.body.title.length).toBeGreaterThan(0);
    expect(alert.body.summary.length).toBeGreaterThan(0);

    const lowerCaseSummary = alert.body.summary.toLowerCase();
    const lowerCaseTitle = alert.body.title.toLowerCase();
    for (const jargon of JARGON_WORDS) {
      expect(lowerCaseSummary).not.toContain(jargon);
      expect(lowerCaseTitle).not.toContain(jargon);
    }
  });

  it("delivers the alert via SSE (in-app) and records a direct channel", async () => {
    const { alertId } = await seedPrediction(ctx.app, { tenantId: tenant.tenantId });
    const alert = await tenant.agent.get(`/alerts/${alertId}`).expect(200);
    expect(alert.body.channels_sent).toEqual(expect.arrayContaining(["in_app", "email"]));
  });

  it("persists correctly when affected_supplier_id references a real supplier", async () => {
    const supplierRes = await tenant.agent
      .post("/suppliers")
      .send({ name: "Real Supplier For Prediction", kind: "primary" })
      .expect(201);

    const { predictionId } = await seedPrediction(ctx.app, {
      tenantId: tenant.tenantId,
      affectedSupplierId: supplierRes.body.id,
    });

    const prediction = await tenant.agent.get(`/predictions/${predictionId}`).expect(200);
    expect(prediction.body.affected_supplier_id).toBe(supplierRes.body.id);
  });

  it("returns 422 (not a raw 500) when affected_supplier_id is stale/unknown", async () => {
    const config = ctx.app.get(ConfigService);
    const token = config.get<string>("AI_SERVICE_TOKEN");
    const nonExistentSupplierId = "00000000-0000-0000-0000-000000000000";

    const res = await request(ctx.app.getHttpServer())
      .post("/internal/predictions")
      .set("x-service-token", token ?? "")
      .send({
        tenant_id: tenant.tenantId,
        type: "supplier_delay",
        affected_supplier_id: nonExistentSupplierId,
        affected_inventory_item_ids: [],
        confidence_score: 0.7,
        predicted_impact_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        created_by_agent: "prediction-agent-v1",
        rationale: "Test rationale.",
      })
      .expect(422);

    expect(res.body.error.message).toMatch(/does not reference an existing supplier/);
  });
});
