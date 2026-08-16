import { Test } from "@nestjs/testing";
import { AuditModule } from "../../src/audit/audit.module";
import { AuditService } from "../../src/audit/audit.service";
import { PrismaModule } from "../../src/common/prisma/prisma.module";
import { PrismaService } from "../../src/common/prisma/prisma.service";

describe("AuditService (T011)", () => {
  let auditService: AuditService;
  let prisma: PrismaService;
  let tenantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, AuditModule],
    }).compile();
    await moduleRef.init();
    auditService = moduleRef.get(AuditService);
    prisma = moduleRef.get(PrismaService);

    // See auth.spec.ts for why this must run under a platform_admin
    // context: RETURNING (which .create() always uses) is subject to the
    // SELECT policy, and a brand-new tenant has no context of its own yet.
    const tenant = await prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: true },
      (tx) => tx.tenant.create({ data: { businessName: "Audit Co", sector: "logistics" } }),
    );
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.withTenantContext({ tenantId: null, isPlatformAdmin: true }, (tx) =>
      tx.tenant.deleteMany({ where: { id: tenantId } }),
    );
    await prisma.$disconnect();
  });

  it("records an entry retrievable via list, scoped to its tenant", async () => {
    await auditService.record(
      { tenantId, isPlatformAdmin: false },
      {
        actor: "agent:prediction-agent-v1",
        action: "prediction.created",
        entityType: "DisruptionPrediction",
        entityId: "11111111-1111-1111-1111-111111111111",
        payload: { confidence: 0.9 },
      },
    );

    const entries = await auditService.list({ tenantId, isPlatformAdmin: false });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: "agent:prediction-agent-v1",
      action: "prediction.created",
      entityType: "DisruptionPrediction",
    });
  });

  it("is invisible to a different tenant's context", async () => {
    const entries = await auditService.list({
      tenantId: "99999999-9999-9999-9999-999999999999",
      isPlatformAdmin: false,
    });
    expect(entries).toHaveLength(0);
  });

  it("exposes no update or delete method — append-only by construction", () => {
    expect((auditService as unknown as { update?: unknown }).update).toBeUndefined();
    expect((auditService as unknown as { delete?: unknown }).delete).toBeUndefined();
  });
});
