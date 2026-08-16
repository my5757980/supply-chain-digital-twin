import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/prisma/prisma.service";
import { RedisService } from "../../src/common/redis/redis.service";
import { createSessionMiddleware } from "../../src/identity/session.middleware";
import { AllExceptionsFilter } from "../../src/common/all-exceptions.filter";

export interface TestAppContext {
  app: INestApplication;
  prisma: PrismaService;
}

/** Mirrors main.ts's bootstrap() as closely as possible — a test app that
 * skips global filters/pipes production actually runs would silently test
 * a different error-handling pipeline than what ships (see the
 * disruption-alert.spec.ts 422-body regression this fixed). */
export async function createTestApp(): Promise<TestAppContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  const prisma = app.get(PrismaService);
  const redisService = app.get(RedisService);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(createSessionMiddleware(redisService, "test-only-secret", false));
  await app.init();
  return { app, prisma };
}

export interface OnboardedTenant {
  tenantId: string;
  ownerId: string;
  agent: ReturnType<typeof request.agent>;
}

export interface OnboardOptions {
  /**
   * Defaults to true: most tests need a tenant that's actually usable,
   * and the AI pipeline refuses to run without consent (Constitution
   * Principle V — see ai-consent-gate.spec.ts). Pass false to test the
   * pre-consent state itself.
   */
  grantAiConsent?: boolean;
}

/** Onboards a fresh tenant via the real `/tenants` endpoint and logs the
 * owner in via the dev-login shim, returning an authenticated supertest
 * agent (cookie jar persists across requests). */
export async function onboardAndLoginOwner(
  app: INestApplication,
  options: OnboardOptions = {},
): Promise<OnboardedTenant> {
  const server = app.getHttpServer();
  const tenantRes = await request(server)
    .post("/tenants")
    .send({
      business_name: `Test SME ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sector: "retail",
      owner_email_or_phone: `owner-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`,
    })
    .expect(201);
  const tenantId = tenantRes.body.id as string;

  const prisma = app.get(PrismaService);
  const owner = await prisma.withTenantContext({ tenantId, isPlatformAdmin: false }, (tx) =>
    tx.user.findFirstOrThrow({ where: { tenantId, role: "owner" } }),
  );

  const agent = request.agent(server);
  await agent.post("/auth/dev-login").send({ userId: owner.id }).expect(200);

  if (options.grantAiConsent !== false) {
    await agent.post("/tenants/me/ai-consent").expect(200);
  }

  return { tenantId, ownerId: owner.id, agent };
}

/**
 * Most child tables use ON DELETE RESTRICT against tenant_id (a deliberate
 * safety default — see the US1 migration), so cleanup must delete children
 * before the tenant itself, in dependency order.
 *
 * `users` and `audit_log_entries` are the exceptions: their FKs are
 * ON DELETE SET NULL, so deleting the tenant silently *orphans* those rows
 * rather than failing. An earlier version of this helper skipped them and
 * leaked 300+ rows across test runs before it was noticed — they must be
 * deleted explicitly.
 */
export async function cleanupTenant(prisma: PrismaService, tenantId: string): Promise<void> {
  await prisma.withTenantContext({ tenantId: null, isPlatformAdmin: true }, async (tx) => {
    await tx.recommendation.deleteMany({ where: { alert: { tenantId } } });
    await tx.autoTriggerRule.deleteMany({ where: { tenantId } });
    await tx.alert.deleteMany({ where: { tenantId } });
    await tx.disruptionPrediction.deleteMany({ where: { tenantId } });
    await tx.logisticsEvent.deleteMany({ where: { order: { tenantId } } });
    await tx.orderLineItem.deleteMany({ where: { order: { tenantId } } });
    await tx.order.deleteMany({ where: { tenantId } });
    await tx.inventoryItem.deleteMany({ where: { tenantId } });
    await tx.supplier.deleteMany({ where: { tenantId } });
    await tx.dataSource.deleteMany({ where: { tenantId } });
    await tx.auditLogEntry.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.tenant.deleteMany({ where: { id: tenantId } });
  });
}

/** Creates and logs in a `staff` user for an existing tenant. */
export async function createAndLoginStaff(
  app: INestApplication,
  tenantId: string,
): Promise<{ staffId: string; agent: ReturnType<typeof request.agent> }> {
  const prisma = app.get(PrismaService);
  const staff = await prisma.withTenantContext({ tenantId, isPlatformAdmin: false }, (tx) =>
    tx.user.create({
      data: {
        tenantId,
        emailOrPhone: `staff-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`,
        role: "staff",
        name: "Staff",
      },
    }),
  );
  const agent = request.agent(app.getHttpServer());
  await agent.post("/auth/dev-login").send({ userId: staff.id }).expect(200);
  return { staffId: staff.id, agent };
}

export interface SeedPredictionInput {
  tenantId: string;
  type?: "supplier_delay" | "port_congestion" | "demand_spike";
  affectedSupplierId?: string;
  affectedInventoryItemIds?: string[];
  confidenceScore?: number;
  leadTimeHours?: number;
  createdByAgent?: string;
  rationale?: string;
}

export interface SeedPredictionResult {
  predictionId: string;
  alertId: string;
}

/** Exercises the real `/internal/predictions` callback (T046) rather than
 * writing DB rows directly, so tests cover the actual pipeline an AI
 * service call would trigger (prediction persisted, alert generated,
 * notified). */
export async function seedPrediction(
  app: INestApplication,
  input: SeedPredictionInput,
): Promise<SeedPredictionResult> {
  const config = app.get(ConfigService);
  const token = config.get<string>("AI_SERVICE_TOKEN");
  const leadTimeHours = input.leadTimeHours ?? 72;
  const predictedImpactAt = new Date(Date.now() + leadTimeHours * 60 * 60 * 1000);

  const res = await request(app.getHttpServer())
    .post("/internal/predictions")
    .set("x-service-token", token ?? "")
    .send({
      tenant_id: input.tenantId,
      type: input.type ?? "supplier_delay",
      affected_supplier_id: input.affectedSupplierId,
      affected_inventory_item_ids: input.affectedInventoryItemIds ?? [],
      confidence_score: input.confidenceScore ?? 0.8,
      predicted_impact_at: predictedImpactAt.toISOString(),
      created_by_agent: input.createdByAgent ?? "prediction-agent-v1",
      rationale: input.rationale ?? "A supplier has recently missed delivery windows.",
    })
    .expect(201);

  return { predictionId: res.body.prediction_id, alertId: res.body.alert_id };
}

export interface SeedRecommendationInput {
  tenantId: string;
  alertId: string;
  steps?: string[];
  recommendedSupplierId?: string;
  recommendedDirectoryEntryId?: string;
}

export interface SeedRecommendationResult {
  recommendationId: string;
  ownerDecision: string;
  autoTriggered: boolean;
}

/** Exercises the real `/internal/recommendations` callback (T066). */
export async function seedRecommendation(
  app: INestApplication,
  input: SeedRecommendationInput,
): Promise<SeedRecommendationResult> {
  const config = app.get(ConfigService);
  const token = config.get<string>("AI_SERVICE_TOKEN");

  const res = await request(app.getHttpServer())
    .post("/internal/recommendations")
    .set("x-service-token", token ?? "")
    .send({
      tenant_id: input.tenantId,
      alert_id: input.alertId,
      steps: input.steps ?? ["Step one.", "Step two."],
      recommended_supplier_id: input.recommendedSupplierId,
      recommended_directory_entry_id: input.recommendedDirectoryEntryId,
    })
    .expect(201);

  return {
    recommendationId: res.body.id,
    ownerDecision: res.body.owner_decision,
    autoTriggered: res.body.auto_triggered,
  };
}
