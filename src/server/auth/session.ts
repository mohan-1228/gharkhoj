import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session-token";
import type { SessionUser } from "./types";

/**
 * Current user for this request (memoised per request). The cookie proves who
 * the caller is; the DATABASE decides their role and whether they are banned.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value, env.SESSION_SECRET);
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, fullName: true, role: true, isBanned: true },
  });
  if (!user || user.isBanned) return null;
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
});

export async function startSession(user: { id: string; role: Role }): Promise<void> {
  const token = await signSession({ sub: user.id, role: user.role }, env.SESSION_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(env.NODE_ENV === "production"));
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
