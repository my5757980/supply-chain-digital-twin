import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { RedisService } from "./common/redis/redis.service";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { setupSwagger } from "./common/swagger";
import { createSessionMiddleware } from "./identity/session.middleware";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const redisService = app.get(RedisService);

  // The browser refuses `Access-Control-Allow-Origin: *` on credentialed
  // requests, and every call from apps/web sends the session cookie — so
  // the allowed origins must be listed explicitly, never left as the
  // wildcard `enableCors()` defaults to.
  const allowedOrigins = (
    config.get<string>("CORS_ORIGINS") ?? "http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const isProduction = config.get<string>("NODE_ENV") === "production";
  const sessionSecret = config.get<string>("SESSION_SECRET") ?? "dev-only-insecure-secret";
  app.use(createSessionMiddleware(redisService, sessionSecret, isProduction));

  setupSwagger(app);

  const port = config.get<string>("PORT") ?? 4000;
  await app.listen(port);
}

void bootstrap();
