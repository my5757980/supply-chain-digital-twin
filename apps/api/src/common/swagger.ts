import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Logger, type INestApplication } from "@nestjs/common";
import { parse } from "yaml";
import * as swaggerUi from "swagger-ui-express";

const logger = new Logger("Swagger");

const CONTRACT_RELATIVE_PATH = join(
  "specs",
  "001-supply-chain-digital-twin",
  "contracts",
  "api.yaml",
);

/** `__dirname` is `apps/api/src/common` under ts-node/jest but
 * `apps/api/dist/src/common` once built, so walk up looking for the
 * contract rather than hard-coding a level count that only works in one
 * of those. */
function findContractFile(): string | null {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, CONTRACT_RELATIVE_PATH);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Serves the hand-written API contract at /docs (T074). The contract stays
 * the source of truth rather than generating a spec from decorators —
 * Constitution Principle II makes it the thing UI/integrations are built
 * against, so the docs must show that file, not a re-derivation of the
 * implementation.
 */
export function setupSwagger(app: INestApplication): void {
  const contractPath = findContractFile();
  if (!contractPath) {
    logger.warn(`Could not locate ${CONTRACT_RELATIVE_PATH}; /docs not served`);
    return;
  }

  try {
    const document = parse(readFileSync(contractPath, "utf-8")) as swaggerUi.JsonObject;
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(document));
    logger.log(`API contract served at /docs (from ${contractPath})`);
  } catch (error) {
    // Docs are a convenience, never a reason to fail startup.
    logger.warn(
      `Could not serve API contract at /docs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
