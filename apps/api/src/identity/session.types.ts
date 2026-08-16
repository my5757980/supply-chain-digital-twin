import "express-session";

export type UserRole = "owner" | "staff" | "platform_admin";

export interface SessionUser {
  id: string;
  tenantId: string | null;
  role: UserRole;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}
