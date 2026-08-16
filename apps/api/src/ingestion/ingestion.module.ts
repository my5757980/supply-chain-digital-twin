import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { TwinModule } from "../twin/twin.module";
import { InventoryController } from "./inventory.controller";
import { SupplierController } from "./supplier.controller";
import { CsvUploadController } from "./csv-upload.controller";
import { CsvIngestionQueue } from "./csv-ingestion.queue";
import { FreshnessCheckerService } from "./freshness-checker.service";

@Module({
  imports: [PrismaModule, AuditModule, IdentityModule, TwinModule],
  controllers: [InventoryController, SupplierController, CsvUploadController],
  providers: [CsvIngestionQueue, FreshnessCheckerService],
  exports: [CsvIngestionQueue, FreshnessCheckerService],
})
export class IngestionModule {}
