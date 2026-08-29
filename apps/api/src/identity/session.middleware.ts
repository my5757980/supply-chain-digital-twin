import session, { type SessionOptions } from "express-session";
import RedisStore from "connect-redis";
import type { CookieOptions, RequestHandler } from "express";
import type { RedisService } from "../common/redis/redis.service";

/**
 * Cookie policy, split out so it can be asserted directly — the production
 * values are impossible to exercise from a same-origin test request, and
 * getting them wrong breaks login in a way no server-side test would catch.
 *
 * In production the frontend and the API are served from different sites
 * (the web app on its host, the API on its own), which makes the session
 * cookie cross-site. `SameSite=Lax` — the right default for a same-site
 * app — is NOT sent on cross-site fetch/XHR, so every request after login
 * would arrive unauthenticated. `None` is required for that, and browsers
 * only accept `None` together with `Secure`, which is why the two move as
 * a pair.
 */
export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  };
}

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
    cookie: sessionCookieOptions(isProduction),
  };
  return session(options);
}
