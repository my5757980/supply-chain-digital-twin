import { Controller, Get, INestApplication, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { Request, RequestHandler } from "express";
import { TenantThrottlerGuard } from "../../src/common/tenant-throttler.guard";
import type { SessionUser } from "../../src/identity/session.types";

@Controller("ping")
class PingController {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

/** Tight limit so the 429 boundary is reachable in a test — the real app
 * uses a deliberately generous limit (see app.module.ts). */
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
  controllers: [PingController],
  providers: [{ provide: APP_GUARD, useClass: TenantThrottlerGuard }],
})
class ThrottleTestModule {}

/** Injects a fake session so the guard's per-tenant branch is exercised
 * without standing up real auth. The guard only reads `session.user`, so a
 * partial stub is sufficient — cast through `unknown` because
 * express-session's type augmentation describes the full Session object. */
function fakeSession(user: SessionUser | undefined): RequestHandler {
  return (req, _res, next) => {
    (req as Request).session = { user } as unknown as Request["session"];
    next();
  };
}

describe("Rate limiting (T073)", () => {
  async function buildApp(user: SessionUser | undefined): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [ThrottleTestModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.use(fakeSession(user));
    await app.init();
    return app;
  }

  it("returns 429 once a tenant exceeds its limit", async () => {
    const app = await buildApp({ id: "u1", tenantId: "tenant-aaa", role: "owner" });
    try {
      await request(app.getHttpServer()).get("/ping").expect(200);
      await request(app.getHttpServer()).get("/ping").expect(200);
      await request(app.getHttpServer()).get("/ping").expect(429);
    } finally {
      await app.close();
    }
  });

  it("limits per tenant, not globally — a second tenant is unaffected", async () => {
    const appA = await buildApp({ id: "u1", tenantId: "tenant-bbb", role: "owner" });
    try {
      await request(appA.getHttpServer()).get("/ping").expect(200);
      await request(appA.getHttpServer()).get("/ping").expect(200);
      await request(appA.getHttpServer()).get("/ping").expect(429);
    } finally {
      await appA.close();
    }

    // Different tenant, same process/IP: must get its own fresh budget.
    const appB = await buildApp({ id: "u2", tenantId: "tenant-ccc", role: "owner" });
    try {
      await request(appB.getHttpServer()).get("/ping").expect(200);
    } finally {
      await appB.close();
    }
  });

  it("falls back to IP for unauthenticated requests", async () => {
    const app = await buildApp(undefined);
    try {
      await request(app.getHttpServer()).get("/ping").expect(200);
      await request(app.getHttpServer()).get("/ping").expect(200);
      await request(app.getHttpServer()).get("/ping").expect(429);
    } finally {
      await app.close();
    }
  });
});
