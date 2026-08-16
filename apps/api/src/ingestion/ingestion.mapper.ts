import type { InventoryItem, Supplier } from "@prisma/client";

/** Matches `contracts/api.yaml`'s `InventoryItem` schema. */
export interface InventoryItemResponse {
  id: string;
  sku: string;
  name: string;
  quantity_on_hand: number;
  reorder_threshold: number | null;
  data_source_id: string | null;
  updated_at: string;
}

export function toInventoryItemResponse(item: InventoryItem): InventoryItemResponse {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    quantity_on_hand: Number(item.quantityOnHand),
    reorder_threshold: item.reorderThreshold === null ? null : Number(item.reorderThreshold),
    data_source_id: item.dataSourceId,
    updated_at: item.updatedAt.toISOString(),
  };
}

/** Matches `contracts/api.yaml`'s `Supplier` schema. */
export interface SupplierResponse {
  id: string;
  name: string;
  kind: string;
  status: string;
  typical_lead_time_days: number | null;
  location: string | null;
}

export function toSupplierResponse(supplier: Supplier): SupplierResponse {
  return {
    id: supplier.id,
    name: supplier.name,
    kind: supplier.kind,
    status: supplier.status,
    typical_lead_time_days: supplier.typicalLeadTimeDays,
    location: supplier.location,
  };
}
