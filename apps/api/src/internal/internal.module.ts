import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { ActionModule } from "../action/action.module";
import { NotificationModule } from "../notification/notification.module";
import { IdentityModule } from "../identity/identity.module";
import { InternalController } from "./internal.controller";
import { ServiceTokenGuard } from "./service-token.guard";
import { PredictionsCallbackController } from "./predictions-callback.controller";
import { RecommendationsCallbackController } from "./recommendations-callback.controller";

@Module({
  imports: [PrismaModule, AuditModule, ActionModule, NotificationModule, IdentityModule],
  controllers: [
    InternalController,
    PredictionsCallbackController,
    RecommendationsCallbackController,
  ],
  providers: [ServiceTokenGuard],
  exports: [ServiceTokenGuard],
})
export class InternalModule {}
