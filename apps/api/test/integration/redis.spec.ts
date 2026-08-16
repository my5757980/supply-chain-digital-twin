import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { RedisModule } from "../../src/common/redis/redis.module";
import { RedisService } from "../../src/common/redis/redis.service";

describe("RedisService (T012)", () => {
  let redisService: RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), RedisModule],
    }).compile();
    await moduleRef.init();
    redisService = moduleRef.get(RedisService);
  });

  afterAll(async () => {
    await redisService.client.del("scdt:test:roundtrip");
    redisService.client.disconnect();
  });

  it("round-trips a set/get through the shared client", async () => {
    await redisService.client.set("scdt:test:roundtrip", "hello-redis");
    const value = await redisService.client.get("scdt:test:roundtrip");
    expect(value).toBe("hello-redis");
  });
});
