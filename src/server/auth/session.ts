import "server-only";
import { prisma } from "../lib/db";
import type { SessionUser } from "./types";

/**
 * PHASE 1 STUB (CLAUDE.md roadmap): every request acts as the seeded demo
 * landlord. Replaced by real cookie sessions + Cognito in phase 5.
 */
const STUB_LANDLORD_EMAIL = "sita.landlord@gharkhoj.local";

export async function getCurrentUser(): Promise<SessionUser | null> {
  return prisma.user.findUnique({
    where: { email: STUB_LANDLORD_EMAIL },
    select: { id: true, email: true, fullName: true, role: true },
  });
}
