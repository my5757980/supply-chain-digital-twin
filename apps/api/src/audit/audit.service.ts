import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService, TenantContext } from "../common/prisma/prisma.service";

export interface RecordAuditEntryInput {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload: Prisma.InputJsonValue;
}

/**
 * Append-only. This is the ONLY write path onto AuditLogEntry — no
 * update/delete method exists anywhere in the codebase, by design
 * (Constitution Principle IV; user's explicit "audit logs for every AI
 * recommendation" requirement).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(context: TenantContext, input: RecordAuditEntryInput): Promise<void> {
    await this.prisma.withTenantContext(context, async (tx) => {
      await tx.auditLogEntry.create({
        data: {
          tenantId: context.tenantId,
          actor: input.actor,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          payload: input.payload,
        },
      });
    });
  }

  async list(context: TenantContext, entityType?: string): Promise<
    Array<{
      id: string;
      actor: string;
      action: string;
      entityType: string;
      entityId: string | null;
      payload: Prisma.JsonValue;
      createdAt: Date;
    }>
  > {
    return this.prisma.withTenantContext(context, (tx) =>
      tx.auditLogEntry.findMany({
        where: entityType ? { entityType } : undefined,
        orderBy: { createdAt: "desc" },
      }),
    );
  }
}
