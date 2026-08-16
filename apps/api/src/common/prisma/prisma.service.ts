import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

export interface TenantContext {
  tenantId: string | null;
  isPlatformAdmin: boolean;
}

type TenantScopedClient = Prisma.TransactionClient;

/**
 * Every tenant-scoped query MUST go through `withTenantContext`, not the
 * bare PrismaClient methods. The Row-Level Security policies created in
 * `prisma/migrations/20260815044501_init_foundational/migration.sql` key off
 * the `app.tenant_id` / `app.is_platform_admin` Postgres session variables
 * set here — without them, RLS fails closed (zero rows), which is the safe
 * default but means "forgot to set context" fails loudly as empty results
 * rather than a silent cross-tenant leak.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async withTenantContext<T>(
    context: TenantContext,
    work: (tx: TenantScopedClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      if (context.tenantId) {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;
      }
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', ${
        context.isPlatformAdmin ? "true" : "false"
      }, true)`;
      return work(tx);
    });
  }
}
