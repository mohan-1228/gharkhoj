import type { Role } from "@prisma/client";
import { type profileSchema } from "@/schemas/misc";
import type { z } from "zod";
import { assertAuthenticated } from "../auth/guards";
import { deleteCognitoUser, syncCognitoGroup, type CognitoIdentity } from "../auth/cognito";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { AppError } from "../lib/errors";
import { normalizeNepaliMobile } from "@/lib/format";
import { audit } from "./audit";
import { env } from "../lib/env";

/** Only these roles can be self-selected at sign-up. Admin is granted by an admin. */
export type SignupRole = "renter" | "landlord";

/** Open-redirect guard: only same-site relative paths. */
export function safeReturnTo(input: string | null | undefined, fallback = "/"): string {
  if (!input || !input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return fallback;
  return input;
}

/**
 * Find-or-create the local user for a verified Cognito identity.
 * Links to an existing account by email only if Cognito verified that email.
 */
export async function upsertFromCognito(identity: CognitoIdentity, signupRole: SignupRole) {
  if (!identity.email) throw new AppError("UNAUTHENTICATED", "Your account has no email address");
  const user = await findOrCreateFromCognito(identity, signupRole);
  // Bootstrap: allow-listed, VERIFIED emails are promoted to admin (first-admin problem).
  if (identity.emailVerified && env.BOOTSTRAP_ADMIN_EMAILS.includes(identity.email) && user.role !== "admin") {
    const promoted = await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    await syncCognitoGroup(identity.sub, "admin", user.role);
    await audit(null, "user.bootstrap_admin", "user", user.id);
    return promoted;
  }
  return user;
}

async function findOrCreateFromCognito(identity: CognitoIdentity, signupRole: SignupRole) {
  const bySub = await prisma.user.findUnique({ where: { cognitoSub: identity.sub } });
  if (bySub) {
    if (bySub.isBanned) throw new AppError("FORBIDDEN", "This account has been suspended");
    return bySub;
  }
  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
  if (byEmail) {
    if (!identity.emailVerified) throw new AppError("FORBIDDEN", "Verify your email address to link this account");
    if (byEmail.isBanned) throw new AppError("FORBIDDEN", "This account has been suspended");
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: { cognitoSub: identity.sub, isVerified: true },
    });
    await syncCognitoGroup(identity.sub, linked.role);
    return linked;
  }
  const user = await prisma.user.create({
    data: {
      cognitoSub: identity.sub,
      email: identity.email,
      fullName: identity.name ?? identity.email.split("@")[0]!,
      phone: identity.phone,
      role: signupRole,
      isVerified: identity.emailVerified,
      ...(signupRole === "landlord" ? { landlordProfile: { create: {} } } : {}),
    },
  });
  await syncCognitoGroup(identity.sub, user.role);
  await audit(user.id, "user.signup", "user", user.id, { role: user.role, via: "cognito" });
  return user;
}

/** Local development only: sign in as (or create) a user by email. */
export async function devLogin(input: { email: string; fullName?: string; role?: SignupRole }) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.isBanned) throw new AppError("FORBIDDEN", "This account has been suspended");
    return existing;
  }
  const role = input.role ?? "renter";
  return prisma.user.create({
    data: {
      email,
      fullName: input.fullName?.trim() || email.split("@")[0]!,
      role,
      isVerified: true,
      ...(role === "landlord" ? { landlordProfile: { create: {} } } : {}),
    },
  });
}

export async function getMe(actor: SessionUser | null) {
  assertAuthenticated(actor);
  return prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { id: true, email: true, fullName: true, phone: true, role: true, createdAt: true, landlordProfile: true },
  });
}

export async function updateProfile(actor: SessionUser | null, input: z.infer<typeof profileSchema>) {
  assertAuthenticated(actor);
  let phone: string | null | undefined = input.phone;
  if (phone) {
    phone = normalizeNepaliMobile(phone);
    if (!phone) {
      throw new AppError("VALIDATION_ERROR", "Enter a valid Nepali mobile number", {
        fields: [{ path: "phone", message: "Enter a valid Nepali mobile number, e.g. 98XXXXXXXX" }],
      });
    }
  }
  const user = await prisma.user.update({
    where: { id: actor.id },
    data: { fullName: input.fullName, phone: phone || null },
  });
  if (user.role !== "renter" && (input.businessName !== undefined || input.bio !== undefined)) {
    await prisma.landlordProfile.upsert({
      where: { userId: actor.id },
      update: { businessName: input.businessName ?? null, bio: input.bio ?? null },
      create: { userId: actor.id, businessName: input.businessName ?? null, bio: input.bio ?? null },
    });
  }
  return user;
}

/** Renter → landlord is self-service. */
export async function becomeLandlord(actor: SessionUser | null) {
  assertAuthenticated(actor);
  if (actor.role !== "renter") return prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  const user = await prisma.user.update({
    where: { id: actor.id },
    data: { role: "landlord", landlordProfile: { connectOrCreate: { where: { userId: actor.id }, create: {} } } },
  });
  await syncCognitoGroup(user.cognitoSub, "landlord", "renter");
  await audit(actor.id, "user.become_landlord", "user", actor.id);
  return user;
}

/** Privacy: delete account and personal data on request (CLAUDE.md §4.9). */
export async function deleteAccount(actor: SessionUser | null) {
  assertAuthenticated(actor);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (user.role === "admin" && (await prisma.user.count({ where: { role: "admin" } })) <= 1) {
    throw new AppError("INVALID_STATE", "The last admin account cannot be deleted");
  }
  await audit(null, "user.delete_self", "user", actor.id, { role: user.role });
  await prisma.user.delete({ where: { id: actor.id } }); // cascades listings, favorites, tours…
  await deleteCognitoUser(user.cognitoSub);
}

export async function setUserRole(userId: string, role: Role, previous: Role, cognitoSub: string | null) {
  await syncCognitoGroup(cognitoSub, role, previous);
}
