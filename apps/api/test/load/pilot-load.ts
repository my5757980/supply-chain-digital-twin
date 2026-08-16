/**
 * T075 — pilot-scale load check.
 *
 * Verifies the two paths SC-003 depends on ("SME can act on a
 * recommendation within minutes") still respond quickly with the pilot's
 * 150 tenants' worth of data present:
 *   1. alert delivery — POST /internal/predictions (prediction -> alert
 *      persisted and notified), the path between "we spotted it" and "the
 *      owner can see it".
 *   2. GET /twin — the read the owner lands on.
 *
 * Deliberately NOT a full 150-concurrent-user simulation: this runs
 * against a single local Postgres/Redis on a laptop, so a throughput
 * number here would say more about this machine than about the product.
 * What it does establish is that per-request latency doesn't degrade into
 * the minutes once the dataset is at pilot size — which is the actual
 * SC-003 risk. Real capacity numbers need a staging environment.
 *
 * Run: npx ts-node test/load/pilot-load.ts
 */
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/common/prisma/prisma.service";
import { RedisService } from "../../src/common/redis/redis.service";
import { AllExceptionsFilter } from "../../src/common/all-exceptions.filter";
import { createSessionMiddleware } from "../../src/identity/session.middleware";

const TENANT_COUNT = Number(process.env.LOAD_TENANTS ?? 150);
const ITEMS_PER_TENANT = Number(process.env.LOAD_ITEMS ?? 20);
const SC003_BUDGET_MS = 5 * 60 * 1000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function summarize(label: string, samples: number[]): { p50: number; p95: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const stats = {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0,
  };
  console.log(
    `${label.padEnd(28)} n=${samples.length.toString().padStart(4)}  ` +
      `p50=${stats.p50.toFixed(0).padStart(5)}ms  ` +
      `p95=${stats.p95.toFixed(0).padStart(5)}ms  ` +
      `max=${stats.max.toFixed(0).padStart(5)}ms`,
  );
  return stats;
}

async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);
  const config = app.get(ConfigService);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(createSessionMiddleware(redis, "load-test-secret", false));
  await app.init();

  const server = app.getHttpServer();
  const serviceToken = config.get<string>("AI_SERVICE_TOKEN") ?? "";
  const tenantIds: string[] = [];
  const agents: ReturnType<typeof request.agent>[] = [];

  console.log(`\nSeeding ${TENANT_COUNT} tenants x ${ITEMS_PER_TENANT} items...`);
  const seedStart = Date.now();

  for (let i = 0; i < TENANT_COUNT; i += 1) {
    const suffix = `${Date.now()}-${i}`;
    const tenantRes = await request(server)
      .post("/tenants")
      .send({
        business_name: `Load Test SME ${suffix}`,
        sector: "retail",
        owner_email_or_phone: `load-${suffix}@test.co`,
      })
      .expect(201);

    const tenantId = tenantRes.body.id as string;
    tenantIds.push(tenantId);

    const agent = request.agent(server);
    await agent.post("/auth/dev-login").send({ userId: tenantRes.body.owner_user_id }).expect(200);
    await agent.post("/tenants/me/ai-consent").expect(200);
    agents.push(agent);

    for (let j = 0; j < ITEMS_PER_TENANT; j += 1) {
      await agent
        .post("/inventory-items")
        .send({ sku: `SKU-${i}-${j}`, name: `Item ${j}`, quantity_on_hand: 10 + j })
        .expect(201);
    }
    await agent.post("/suppliers").send({ name: `Supplier ${i}`, kind: "backup" }).expect(201);

    if ((i + 1) % 25 === 0) {
      console.log(`  ...${i + 1}/${TENANT_COUNT} tenants seeded`);
    }
  }
  console.log(`Seeded in ${((Date.now() - seedStart) / 1000).toFixed(1)}s\n`);

  try {
    // --- Path 1: alert delivery (prediction -> alert, notified) ---------
    const alertSamples: number[] = [];
    for (const tenantId of tenantIds) {
      const start = Date.now();
      await request(server)
        .post("/internal/predictions")
        .set("x-service-token", serviceToken)
        .send({
          tenant_id: tenantId,
          type: "supplier_delay",
          affected_inventory_item_ids: [],
          confidence_score: 0.9,
          predicted_impact_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          created_by_agent: "load-test",
          rationale: "Load test scenario.",
        })
        .expect(201);
      alertSamples.push(Date.now() - start);
    }

    // --- Path 2: the twin read the owner lands on -----------------------
    const twinSamples: number[] = [];
    for (const agent of agents) {
      const start = Date.now();
      await agent.get("/twin").expect(200);
      twinSamples.push(Date.now() - start);
    }

    console.log("Results:");
    const alertStats = summarize("alert delivery (POST)", alertSamples);
    const twinStats = summarize("twin read (GET /twin)", twinSamples);

    const worst = Math.max(alertStats.p95, twinStats.p95);
    const headroom = SC003_BUDGET_MS / Math.max(worst, 1);
    console.log(
      `\nSC-003 budget: ${SC003_BUDGET_MS}ms. Worst p95: ${worst.toFixed(0)}ms ` +
        `(~${headroom.toFixed(0)}x headroom).`,
    );
    if (worst > SC003_BUDGET_MS) {
      console.error("FAIL: p95 exceeds the SC-003 budget.");
      process.exitCode = 1;
    } else {
      console.log("PASS: both paths are well inside the SC-003 budget.");
    }
  } finally {
    console.log("\nCleaning up load-test tenants...");
    for (const tenantId of tenantIds) {
      await prisma.withTenantContext({ tenantId: null, isPlatformAdmin: true }, async (tx) => {
        await tx.recommendation.deleteMany({ where: { alert: { tenantId } } });
        await tx.autoTriggerRule.deleteMany({ where: { tenantId } });
        await tx.alert.deleteMany({ where: { tenantId } });
        await tx.disruptionPrediction.deleteMany({ where: { tenantId } });
        await tx.inventoryItem.deleteMany({ where: { tenantId } });
        await tx.supplier.deleteMany({ where: { tenantId } });
        await tx.dataSource.deleteMany({ where: { tenantId } });
        await tx.auditLogEntry.deleteMany({ where: { tenantId } });
        await tx.user.deleteMany({ where: { tenantId } });
        await tx.tenant.deleteMany({ where: { id: tenantId } });
      });
    }
    await app.close();
    console.log("Done.");
  }
}

void main();
