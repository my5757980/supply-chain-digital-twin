import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { RedisModule } from "../common/redis/redis.module";
import { NotificationModule } from "../notification/notification.module";
import { IdentityModule } from "../identity/identity.module";
import { TwinController } from "./twin.controller";
import { TwinService } from "./twin.service";

@Module({
  imports: [PrismaModule, RedisModule, NotificationModule, IdentityModule],
  controllers: [TwinController],
  providers: [TwinService],
  exports: [TwinService],
})
export class TwinModule {}
