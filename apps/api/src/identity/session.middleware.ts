import session, { type SessionOptions } from "express-session";
import RedisStore from "connect-redis";
import type { RequestHandler } from "express";
import type { RedisService } from "../common/redis/redis.service";

export function createSessionMiddleware(
  redisService: RedisService,
  secret: string,
  isProduction: boolean,
): RequestHandler {
  const options: SessionOptions = {
    store: new RedisStore({ client: redisService.client, prefix: "scdt:sess:" }),
    secret,
    name: "session",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  };
  return session(options);
}
