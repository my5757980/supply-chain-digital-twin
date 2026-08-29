import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

export interface SweepCandidate {
  tenant_id: string;
  supplier_id: string;
  supplier_name: string;
  affected_inventory_item_ids: string[];
  lead_time_hours: number;
}

/**
 * Answers "which businesses are worth running the prediction agents for
 * right now", so the prediction layer can pull that list rather than the
 * platform pushing work into it (Principle IX keeps the direction
 * one-way: apps/ai-service calls apps/api, never the reverse).
 *
 * The selection is a stand-in for a real signal feed. Live carrier, port
 * and supplier-portal data is a pilot-stage integration; until then the
 * sweep looks for the shape of a business that would be hurt by a delay —
 * it has consented to AI processing, it has a main supplier, and something
 * is already below its reorder level — and lets the Prediction Agent judge
 * whether that is worth warning about. Nothing here decides severity or
 * timing; the 48-hour floor still lives in the agent.
 */
@Injectable()
export class SweepCandidatesService {
  /** Matches the demo signal's lead time; the agent enforces the 48h floor. */
  private static readonly DEFAULT_LEAD_TIME_HOURS = 72;

  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(): Promise<SweepCandidate[]> {
    return this.prisma.withTenantContext(
      { tenantId: null, isPlatformAdmin: true },
      async (tx) => {
        // Principle V: a tenant that has not consented is never a candidate,
        // because being a candidate means its data reaches a model.
        const tenants = await tx.tenant.findMany({
          where: { aiProcessingConsentAt: { not: null } },
          select: { id: true },
        });

        const candidates: SweepCandidate[] = [];

        for (const tenant of tenants) {
          const supplier = await tx.supplier.findFirst({
            where: { tenantId: tenant.id, kind: "primary", status: "active" },
            orderBy: { name: "asc" },
            select: { id: true, name: true, typicalLeadTimeDays: true },
          });
          if (!supplier) continue;

          // Skip anyone already holding an open prediction for this supplier.
          // Without this the sweep would raise a fresh alert on every pass and
          // teach owners to ignore the whole channel.
          const openPrediction = await tx.disruptionPrediction.findFirst({
            where: {
              tenantId: tenant.id,
              affectedSupplierId: supplier.id,
              status: "active",
            },
            select: { id: true },
          });
          if (openPrediction) continue;

          // The data model links items to suppliers only through orders, so
          // there is no direct "what does this supplier serve" query. Items
          // already below their reorder level are the ones a delay would
          // actually hurt, which is the set worth reasoning about.
          const items = await tx.inventoryItem.findMany({
            where: { tenantId: tenant.id, reorderThreshold: { not: null } },
            select: { id: true, quantityOnHand: true, reorderThreshold: true },
          });
          const atRisk = items
            .filter(
              (item) =>
                item.reorderThreshold !== null &&
                item.quantityOnHand.lessThanOrEqualTo(item.reorderThreshold),
            )
            .map((item) => item.id);
          if (atRisk.length === 0) continue;

          candidates.push({
            tenant_id: tenant.id,
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            affected_inventory_item_ids: atRisk,
            lead_time_hours:
              supplier.typicalLeadTimeDays != null
                ? supplier.typicalLeadTimeDays * 24
                : SweepCandidatesService.DEFAULT_LEAD_TIME_HOURS,
          });
        }

        return candidates;
      },
    );
  }
}
