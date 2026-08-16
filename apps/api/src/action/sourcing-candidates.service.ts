import { Injectable } from "@nestjs/common";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";

export interface SourcingCandidate {
  id: string;
  name: string;
  location: string | null;
}

export interface SourcingCandidates {
  own_backup_suppliers: SourcingCandidate[];
  directory_entries: SourcingCandidate[];
}

/**
 * Surfaces the two pools FR-006 / the Sourcing Recommendation Agent
 * chooses between: the tenant's own registered backup suppliers, and the
 * platform-curated Local Supplier Directory (global, matched by sector) as
 * a fallback. Returned to apps/ai-service alongside the prediction
 * callback response so the agent can make its own-backup-first decision
 * without apps/api needing to know that policy itself.
 */
@Injectable()
export class SourcingCandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findFor(context: TenantContext): Promise<SourcingCandidates> {
    const tenantId = context.tenantId as string;
    return this.prisma.withTenantContext(context, async (tx) => {
      const [tenant, ownBackups] = await Promise.all([
        tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
        tx.supplier.findMany({ where: { tenantId, kind: "backup" }, orderBy: { name: "asc" } }),
      ]);

      const directoryEntries = await tx.localSupplierDirectoryEntry.findMany({
        where: { sector: tenant.sector, verified: true },
        orderBy: { name: "asc" },
      });

      return {
        own_backup_suppliers: ownBackups.map((s) => ({
          id: s.id,
          name: s.name,
          location: s.location,
        })),
        directory_entries: directoryEntries.map((d) => ({
          id: d.id,
          name: d.name,
          location: d.location,
        })),
      };
    });
  }
}
