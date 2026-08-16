import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Shared Redis client for the twin snapshot cache, SSE pub/sub fan-out, and
 * the ingestion/agent job queue (see research.md §5).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  /** Creates a second connection for subscribe use (ioredis requires a
   * dedicated connection per subscriber; the primary client stays free for
   * normal commands). Callers own the returned instance's lifecycle. */
  createSubscriber(): Redis {
    return this.client.duplicate();
  }
}
