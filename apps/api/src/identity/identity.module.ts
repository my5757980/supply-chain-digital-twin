import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TenantController } from "./tenant.controller";
import { TenantService } from "./tenant.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AuthController, TenantController],
  providers: [AuthService, TenantService],
  exports: [AuthService, TenantService],
})
export class IdentityModule {}
