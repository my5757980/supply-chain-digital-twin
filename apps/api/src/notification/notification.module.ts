import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { IdentityModule } from "../identity/identity.module";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { TwinEventsService } from "./twin-events.service";
import { AlertNotifierService } from "./alert-notifier.service";

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [NotificationController],
  providers: [NotificationService, TwinEventsService, AlertNotifierService],
  exports: [NotificationService, TwinEventsService, AlertNotifierService],
})
export class NotificationModule {}
