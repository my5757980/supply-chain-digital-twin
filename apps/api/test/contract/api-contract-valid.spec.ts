import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

/**
 * The API contract is the source of truth (Constitution Principle II), but
 * nothing validated it until T074 tried to serve it — at which point it
 * turned out to have been syntactically invalid YAML for days, silently.
 * This test closes that gap: a malformed contract now fails CI instead of
 * quietly disabling /docs.
 */
describe("API contract (contracts/api.yaml)", () => {
  const relative = join("specs", "001-supply-chain-digital-twin", "contracts", "api.yaml");

  function findContract(): string {
    let dir = __dirname;
    for (let i = 0; i < 8; i += 1) {
      const candidate = join(dir, relative);
      if (existsSync(candidate)) return candidate;
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
    throw new Error(`Could not locate ${relative}`);
  }

  const document = parse(readFileSync(findContract(), "utf-8")) as {
    openapi?: string;
    paths?: Record<string, unknown>;
    components?: { schemas?: Record<string, unknown> };
  };

  it("is parseable YAML declaring an OpenAPI 3 document", () => {
    expect(document.openapi).toMatch(/^3\./);
  });

  it("declares paths and schemas", () => {
    expect(Object.keys(document.paths ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(document.components?.schemas ?? {}).length).toBeGreaterThan(0);
  });

  it("documents the routes the implementation actually exposes", () => {
    // Not exhaustive — a guard against the contract drifting out of sync
    // with the endpoints the app serves.
    const paths = Object.keys(document.paths ?? {});
    for (const expected of [
      "/tenants",
      "/twin",
      "/inventory-items",
      "/suppliers",
      "/predictions",
      "/alerts",
      "/alerts/{id}/decision",
      "/auto-trigger-rules",
      "/audit-logs",
      "/events/stream",
    ]) {
      expect(paths).toContain(expected);
    }
  });
});
