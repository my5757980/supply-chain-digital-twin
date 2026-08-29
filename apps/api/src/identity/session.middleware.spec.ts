import { sessionCookieOptions } from "./session.middleware";

/**
 * These assertions exist because the production cookie policy cannot be
 * exercised by the integration suite: every test request is same-origin
 * over plain HTTP, where `lax` works fine. In production the web app and
 * the API are on different sites, and a `lax` cookie is simply never sent
 * on cross-site fetch — login would appear to succeed and every subsequent
 * request would arrive unauthenticated, with nothing in the logs to say so.
 */
describe("sessionCookieOptions", () => {
  describe("in production", () => {
    const cookie = sessionCookieOptions(true);

    it("uses SameSite=None so the cookie survives a cross-site request", () => {
      expect(cookie.sameSite).toBe("none");
    });

    it("sets Secure, which browsers require alongside SameSite=None", () => {
      expect(cookie.secure).toBe(true);
    });
  });

  describe("in development", () => {
    const cookie = sessionCookieOptions(false);

    it("uses SameSite=Lax, since localhost is same-site", () => {
      expect(cookie.sameSite).toBe("lax");
    });

    it("does not set Secure, so the cookie works over plain HTTP", () => {
      expect(cookie.secure).toBe(false);
    });
  });

  it("keeps the cookie inaccessible to scripts in both environments", () => {
    expect(sessionCookieOptions(true).httpOnly).toBe(true);
    expect(sessionCookieOptions(false).httpOnly).toBe(true);
  });
});
