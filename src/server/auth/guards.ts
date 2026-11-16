import type { Role } from "@prisma/client";
import { forbidden, unauthenticated } from "../lib/errors";
import type { SessionUser } from "./types";

/** Service-layer role checks — the authoritative authorization boundary. */
export function assertAuthenticated(user: SessionUser | null): asserts user is SessionUser {
  if (!user) throw unauthenticated();
}

export function assertRole(user: SessionUser | null, ...roles: Role[]): asserts user is SessionUser {
  assertAuthenticated(user);
  if (!roles.includes(user.role)) throw forbidden();
}

/** Owner of a resource, or an admin. */
export function assertOwnerOrAdmin(user: SessionUser, ownerId: string): void {
  if (user.id !== ownerId && user.role !== "admin") throw forbidden();
}
