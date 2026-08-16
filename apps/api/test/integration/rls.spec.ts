import { Test } from "@nestjs/testing";
import { PrismaModule } from "../../src/common/prisma/prisma.module";
import { PrismaService } from "../../src/common/prisma/prisma.service";

/**
 * Foundational smoke test for the Row-Level Security policies (T009).
 * FR-011 / SC-006 get their full end-to-end coverage once real endpoints
 * exist (T023, in User Story 1) — this test only proves the database-level
 * guarantee itself holds, independent of any controller.
 */
describe("Row-Level Security isolation (T009)", () => {
  let prisma: PrismaService;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);

    // See auth.spec.ts for why: RETURNING is subject to the SELECT policy,
    // so creating a tenant needs a platform_admin context.
    const [tenantA, tenantB] = await prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: true },
      async (tx) => [
        await tx.tenant.create({ data: { businessName: "RLS Tenant A", sector: "retail" } }),
        await tx.tenant.create({ data: { businessName: "RLS Tenant B", sector: "retail" } }),
      ],
    );
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
  });

  afterAll(async () => {
    await prisma.withTenantContext({ tenantId: null, isPlatformAdmin: true }, (tx) =>
      tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } }),
    );
    await prisma.$disconnect();
  });

  it("a tenant context sees only its own tenant row", async () => {
    const rows = await prisma.withTenantContext({ tenantId: tenantAId, isPlatformAdmin: false }, (tx) =>
      tx.tenant.findMany({ where: { id: { in: [tenantAId, tenantBId] } } }),
    );
    expect(rows.map((r) => r.id)).toEqual([tenantAId]);
  });

  it("a platform_admin context sees both tenants", async () => {
    const rows = await prisma.withTenantContext({ tenantId: null, isPlatformAdmin: true }, (tx) =>
      tx.tenant.findMany({ where: { id: { in: [tenantAId, tenantBId] } } }),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([tenantAId, tenantBId].sort());
  });

  it("fails closed: no context set at all returns zero rows, not everything", async () => {
    const rows = await prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: false },
      (tx) => tx.tenant.findMany({ where: { id: { in: [tenantAId, tenantBId] } } }),
    );
    expect(rows).toHaveLength(0);
  });
});
