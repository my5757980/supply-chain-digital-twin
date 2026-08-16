import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RedisModule } from "./common/redis/redis.module";
import { CorrelationIdMiddleware } from "./common/correlation-id.middleware";
import { TenantThrottlerGuard } from "./common/tenant-throttler.guard";
import { IdentityModule } from "./identity/identity.module";
import { AuditModule } from "./audit/audit.module";
import { InternalModule } from "./internal/internal.module";
import { NotificationModule } from "./notification/notification.module";
import { TwinModule } from "./twin/twin.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { ActionModule } from "./action/action.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    // T073: generous by default — an SME owner clicking around a dashboard
    // should never trip this; it exists to cap abuse, not to shape normal
    // traffic. Tunable per environment without a code change.
    //
    // Disabled under NODE_ENV=test: the whole integration suite shares one
    // source IP, so unauthenticated calls (onboarding) would exhaust a
    // single shared budget, and the storage's per-record expiry timers keep
    // the event loop alive long enough to stall Jest teardown between
    // suites. The guard itself is covered directly by rate-limit.spec.ts,
    // which stands up its own app with a tight limit.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get<string>("THROTTLE_TTL_MS") ?? 60_000),
            limit: Number(config.get<string>("THROTTLE_LIMIT") ?? 300),
          },
        ],
        skipIf: () => config.get<string>("NODE_ENV") === "test",
      }),
    }),
    PrismaModule,
    RedisModule,
    IdentityModule,
    AuditModule,
    InternalModule,
    NotificationModule,
    TwinModule,
    IngestionModule,
    ActionModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: TenantThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
