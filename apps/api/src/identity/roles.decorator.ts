import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "./session.types";

export const ROLES_KEY = "roles";

/** Restricts a route to the given session roles (used with `RolesGuard`). */
export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
