import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AuditService } from "./audit.service";
import { AuditLogController } from "./audit-log.controller";

@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
