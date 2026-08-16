import { ConfigModule } from "@nestjs/config";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalModule } from "../../src/internal/internal.module";

describe("Service-to-service auth (T014)", () => {
  let app: INestApplication;
  const token = "test-service-token";

  beforeAll(async () => {
    process.env.AI_SERVICE_TOKEN = token;
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), InternalModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a request without the service token", async () => {
    await request(app.getHttpServer()).get("/internal/ping").expect(403);
  });

  it("rejects a request with the wrong service token", async () => {
    await request(app.getHttpServer())
      .get("/internal/ping")
      .set("x-service-token", "wrong-token")
      .expect(403);
  });

  it("accepts a request with the correct service token", async () => {
    await request(app.getHttpServer())
      .get("/internal/ping")
      .set("x-service-token", token)
      .expect(200, { status: "ok" });
  });
});
