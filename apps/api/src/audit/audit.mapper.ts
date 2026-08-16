import type { Prisma } from "@prisma/client";

/** Matches `contracts/api.yaml`'s `AuditLogEntry` schema. */
export interface AuditLogEntryResponse {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: Prisma.JsonValue;
  created_at: string;
}

export function toAuditLogEntryResponse(entry: {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): AuditLogEntryResponse {
  return {
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    payload: entry.payload,
    created_at: entry.createdAt.toISOString(),
  };
}
