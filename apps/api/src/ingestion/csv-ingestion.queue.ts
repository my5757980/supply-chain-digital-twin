import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { parse } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { TwinService } from "../twin/twin.service";

export interface CsvIngestionJobData {
  dataSourceId: string;
  tenantId: string;
  dataType: "inventory" | "orders" | "suppliers";
  csvContent: string;
}

const QUEUE_NAME = "csv-ingestion";

/**
 * Real, Redis-backed async ingestion pipeline (FR-001 / T029) — the upload
 * controller returns `202 processing` immediately; this queue's Worker does
 * the actual parsing/persisting out-of-band, matching research.md §5's
 * "Redis... job queue" decision.
 */
@Injectable()
export class CsvIngestionQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CsvIngestionQueue.name);
  private connection!: IORedis;
  private queue!: Queue<CsvIngestionJobData>;
  private worker!: Worker<CsvIngestionJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly twinService: TwinService,
  ) {}

  onModuleInit(): void {
    const url = this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    // BullMQ requires maxRetriesPerRequest: null on its Redis connection.
    this.connection = new IORedis(url, { maxRetriesPerRequest: null });
    this.queue = new Queue<CsvIngestionJobData>(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker<CsvIngestionJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(`CSV ingestion job ${job?.id ?? "?"} failed: ${err.message}`, err.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  async enqueue(data: CsvIngestionJobData): Promise<Job<CsvIngestionJobData>> {
    return this.queue.add("ingest", data);
  }

  private async process(job: Job<CsvIngestionJobData>): Promise<void> {
    const { dataSourceId, tenantId, dataType, csvContent } = job.data;
    const rows: Record<string, string>[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    await this.prisma.withTenantContext({ tenantId, isPlatformAdmin: false }, async (tx) => {
      if (dataType === "inventory") {
        for (const row of rows) {
          await tx.inventoryItem.upsert({
            where: { tenantId_sku: { tenantId, sku: row.sku } },
            create: {
              tenantId,
              sku: row.sku,
              name: row.name,
              quantityOnHand: new Prisma.Decimal(row.quantity_on_hand ?? "0"),
              reorderThreshold: row.reorder_threshold
                ? new Prisma.Decimal(row.reorder_threshold)
                : null,
              dataSourceId,
            },
            update: {
              name: row.name,
              quantityOnHand: new Prisma.Decimal(row.quantity_on_hand ?? "0"),
              reorderThreshold: row.reorder_threshold
                ? new Prisma.Decimal(row.reorder_threshold)
                : null,
              dataSourceId,
            },
          });
        }
      } else if (dataType === "suppliers") {
        for (const row of rows) {
          const existing = await tx.supplier.findFirst({ where: { tenantId, name: row.name } });
          const kind = row.kind === "backup" ? "backup" : "primary";
          if (existing) {
            await tx.supplier.update({
              where: { id: existing.id },
              data: { kind, location: row.location ?? null },
            });
          } else {
            await tx.supplier.create({
              data: { tenantId, name: row.name, kind, location: row.location ?? null },
            });
          }
        }
      } else if (dataType === "orders") {
        for (const row of rows) {
          const supplier = await tx.supplier.findFirst({
            where: { tenantId, name: row.supplier_name },
          });
          const item = await tx.inventoryItem.findUnique({
            where: { tenantId_sku: { tenantId, sku: row.sku } },
          });
          if (!supplier || !item) {
            this.logger.warn(
              `Skipping order row for ${row.sku}: unknown supplier or inventory item`,
            );
            continue;
          }
          const order = await tx.order.create({
            data: {
              tenantId,
              supplierId: supplier.id,
              expectedDate: row.expected_date ? new Date(row.expected_date) : null,
            },
          });
          await tx.orderLineItem.create({
            data: {
              orderId: order.id,
              inventoryItemId: item.id,
              quantity: new Prisma.Decimal(row.quantity ?? "1"),
            },
          });
        }
      }

      await tx.dataSource.update({
        where: { id: dataSourceId },
        data: { lastSyncedAt: new Date() },
      });
    });

    await this.audit.record(
      { tenantId, isPlatformAdmin: false },
      {
        actor: "system:csv-ingestion",
        action: "data_source.ingested",
        entityType: "DataSource",
        entityId: dataSourceId,
        payload: { dataType, rowCount: rows.length },
      },
    );

    await this.twinService.refreshAndNotify(tenantId);
  }
}
