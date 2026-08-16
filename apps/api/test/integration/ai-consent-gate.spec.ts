import { ConfigService } from "@nestjs/config";
import request from "supertest";
import {
  createTestApp,
  onboardAndLoginOwner,
  createAndLoginStaff,
  cleanupTenant,
  type TestAppContext,
  type OnboardedTenant,
} from "../helpers/test-app";

function predictionPayload(tenantId: string): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    type: "supplier_delay",
    affected_inventory_item_ids: [],
    confidence_score: 0.8,
    predicted_impact_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    created_by_agent: "prediction-agent-v1",
    rationale: "A supplier has recently missed delivery windows.",
  };
}

/**
 * Constitution Principle V (T078): the AI loop sends tenant data to the
 * Claude API — a third party. That egress must be gated on explicit,
 * logged consent, and `plan.md`'s Constitution Check names
 * `Tenant.ai_processing_consent_at` as the mitigation. These tests are the
 * proof that the gate is actually enforced, not just modelled.
 */
describe("Integration: AI-processing consent gate (T078)", () => {
  let ctx: TestAppContext;
  let tenant: OnboardedTenant;
  let serviceToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    serviceToken = ctx.app.get(ConfigService).get<string>("AI_SERVICE_TOKEN") ?? "";
  });

  beforeEach(async () => {
    // Explicitly NOT granting consent — these tests are about the
    // pre-consent state and the gate that protects it.
    tenant = await onboardAndLoginOwner(ctx.app, { grantAiConsent: false });
  });

  afterEach(async () => {
    await cleanupTenant(ctx.prisma, tenant.tenantId);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("a freshly onboarded tenant has NOT consented and is not active", async () => {
    const tenantRow = await ctx.prisma.withTenantContext(
      { tenantId: tenant.tenantId, isPlatformAdmin: false },
      (tx) => tx.tenant.findUniqueOrThrow({ where: { id: tenant.tenantId } }),
    );
    expect(tenantRow.aiProcessingConsentAt).toBeNull();
    expect(tenantRow.onboardingStatus).not.toBe("active");
  });

  it("refuses to accept an AI prediction before consent is granted", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/internal/predictions")
      .set("x-service-token", serviceToken)
      .send(predictionPayload(tenant.tenantId))
      .expect(403);

    expect(res.body.error.message).toMatch(/has not consented/i);

    // And nothing was persisted as a side effect of the rejected call.
    const count = await ctx.prisma.withTenantContext(
      { tenantId: tenant.tenantId, isPlatformAdmin: false },
      (tx) => tx.disruptionPrediction.count(),
    );
    expect(count).toBe(0);
  });

  it("accepts AI predictions once the owner grants consent", async () => {
    await tenant.agent.post("/tenants/me/ai-consent").expect(200);

    await request(ctx.app.getHttpServer())
      .post("/internal/predictions")
      .set("x-service-token", serviceToken)
      .send(predictionPayload(tenant.tenantId))
      .expect(201);
  });

  it("granting consent activates the tenant and records an audit entry", async () => {
    const res = await tenant.agent.post("/tenants/me/ai-consent").expect(200);
    expect(res.body.ai_processing_consent_at).toEqual(expect.any(String));
    expect(res.body.onboarding_status).toBe("active");

    const audit = await tenant.agent.get("/audit-logs?entity_type=Tenant").expect(200);
    const consentEntries = audit.body.filter(
      (e: { action: string }) => e.action === "tenant.ai_processing_consent_granted",
    );
    expect(consentEntries).toHaveLength(1);
  });

  it("a staff user cannot grant consent on the business's behalf", async () => {
    const staff = await createAndLoginStaff(ctx.app, tenant.tenantId);
    await staff.agent.post("/tenants/me/ai-consent").expect(403);
  });

  it("refuses to accept an AI recommendation before consent is granted", async () => {
    // Grant consent so a prediction/alert can exist, then revoke it to
    // isolate the recommendation callback's own gate.
    await tenant.agent.post("/tenants/me/ai-consent").expect(200);
    const predictionRes = await request(ctx.app.getHttpServer())
      .post("/internal/predictions")
      .set("x-service-token", serviceToken)
      .send(predictionPayload(tenant.tenantId))
      .expect(201);

    await ctx.prisma.withTenantContext(
      { tenantId: tenant.tenantId, isPlatformAdmin: false },
      (tx) =>
        tx.tenant.update({
          where: { id: tenant.tenantId },
          data: { aiProcessingConsentAt: null },
        }),
    );

    await request(ctx.app.getHttpServer())
      .post("/internal/recommendations")
      .set("x-service-token", serviceToken)
      .send({
        tenant_id: tenant.tenantId,
        alert_id: predictionRes.body.alert_id,
        steps: ["Step one."],
      })
      .expect(403);
  });
});
