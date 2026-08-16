import { Injectable } from "@nestjs/common";
import type { DisruptionPrediction } from "@prisma/client";
import { PrismaService, type TenantContext } from "../common/prisma/prisma.service";

export interface AlertContent {
  title: string;
  summary: string;
}

function formatWhen(date: Date): string {
  return `by ${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
}

/**
 * Produces the plain-language alert content (FR-004, Constitution Principle
 * VI) — deliberately template-based rather than another LLM call: the
 * Prediction Agent's `rationale` already carries the open-ended reasoning,
 * so this only needs to compose it with concrete names/dates, which is
 * cheaper, faster, and jargon-free by construction.
 */
@Injectable()
export class AlertFormatterService {
  constructor(private readonly prisma: PrismaService) {}

  async format(
    context: TenantContext,
    prediction: DisruptionPrediction,
  ): Promise<AlertContent> {
    return this.prisma.withTenantContext(context, async (tx) => {
      const items = prediction.affectedInventoryItemIds.length
        ? await tx.inventoryItem.findMany({
            where: { id: { in: prediction.affectedInventoryItemIds } },
          })
        : [];
      const itemNames = items.map((item) => item.name).join(", ") || "your stock";

      const supplier = prediction.affectedSupplierId
        ? await tx.supplier.findUnique({ where: { id: prediction.affectedSupplierId } })
        : null;

      const title = this.buildTitle(prediction.type, supplier?.name);
      const whenText = formatWhen(prediction.predictedImpactAt);
      const summary = `${prediction.rationale} This could affect ${itemNames} ${whenText}.`;

      return { title, summary };
    });
  }

  private buildTitle(type: DisruptionPrediction["type"], supplierName?: string): string {
    switch (type) {
      case "supplier_delay":
        return supplierName ? `Possible delay from ${supplierName}` : "Possible supplier delay";
      case "port_congestion":
        return "Possible shipping delay from port congestion";
      case "demand_spike":
        return "Demand for your items is rising fast";
    }
  }
}
