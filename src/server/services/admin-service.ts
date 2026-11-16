import { revalidateTag as nextRevalidateTag } from "next/cache";
import type { Prisma, Role } from "@prisma/client";
import { slugify } from "@/lib/format";
import type { lookupAmenitySchema, lookupCitySchema, lookupNeighborhoodSchema } from "@/schemas/misc";
import type { z } from "zod";
import { assertRole } from "../auth/guards";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { AppError, notFound } from "../lib/errors";
import { sendEmail } from "../lib/mailer";
import { presignGet } from "../lib/storage";
import { listingApprovedEmail, listingRejectedEmail, verificationDecisionEmail } from "../emails/templates";
import { audit } from "./audit";
import { setUserRole } from "./auth-service";
import { nextStatus } from "./listing-state";
import { photoDto } from "./media-service";
import { detectContactInfo, findPossibleDuplicates } from "./trust";

/** Every function here is admin-only and audit-logged (CLAUDE.md §9b). */

/** Bust the lookup cache; a no-op outside a Next.js request (scripts, tests). */
function revalidateTag(tag: string) {
  try {
    nextRevalidateTag(tag);
  } catch {
    /* not in a Next.js request context */
  }
}

// ───────────────────────── Moderation queue ─────────────────────────

export async function reviewQueue(actor: SessionUser | null) {
  assertRole(actor, "admin");
  const listings = await prisma.listing.findMany({
    where: { status: "pending_review" },
    orderBy: { updatedAt: "asc" }, // oldest first (FIFO)
    take: 50,
    include: {
      city: { select: { name: true } },
      neighborhood: { select: { name: true } },
      photos: { orderBy: { sortOrder: "asc" } },
      landlord: {
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
          landlordProfile: { select: { verificationStatus: true } },
          _count: { select: { listings: true } },
        },
      },
    },
  });
  return Promise.all(
    listings.map(async (l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      description: l.description,
      propertyType: l.propertyType,
      rentNpr: l.rentNpr,
      place: [l.neighborhood?.name, l.city.name].filter(Boolean).join(", "),
      submittedAt: l.updatedAt.toISOString(),
      photos: l.photos.map(photoDto),
      landlord: {
        id: l.landlord.id,
        name: l.landlord.fullName,
        email: l.landlord.email,
        memberSince: l.landlord.createdAt.toISOString(),
        verified: l.landlord.landlordProfile?.verificationStatus === "verified",
        listingCount: l.landlord._count.listings,
      },
      flags: {
        contact: detectContactInfo(`${l.title}\n${l.description}`),
        duplicates: await findPossibleDuplicates(l.id),
        rejectedPhotos: l.photos.filter((p) => p.status === "rejected").length,
      },
    })),
  );
}
export type ReviewItem = Awaited<ReturnType<typeof reviewQueue>>[number];

async function listingWithOwner(id: string) {
  const l = await prisma.listing.findUnique({ where: { id }, include: { landlord: { select: { email: true } } } });
  if (!l) throw notFound("Listing");
  return l;
}

export async function approveListing(actor: SessionUser | null, id: string) {
  assertRole(actor, "admin");
  const l = await listingWithOwner(id);
  const status = nextStatus(l.status, "approve");
  const updated = await prisma.listing.update({
    where: { id },
    data: { status, rejectionReason: null, publishedAt: l.publishedAt ?? new Date() },
  });
  await audit(actor.id, "listing.approve", "listing", id);
  await sendEmail(listingApprovedEmail(l.landlord.email, { appUrl: env.APP_URL, title: l.title, slug: l.slug }));
  return updated;
}

export async function rejectListing(actor: SessionUser | null, id: string, reason: string) {
  assertRole(actor, "admin");
  const l = await listingWithOwner(id);
  const status = nextStatus(l.status, "reject");
  const updated = await prisma.listing.update({ where: { id }, data: { status, rejectionReason: reason } });
  await audit(actor.id, "listing.reject", "listing", id, { reason });
  await sendEmail(listingRejectedEmail(l.landlord.email, { appUrl: env.APP_URL, title: l.title, id, reason }));
  return updated;
}

/** Admin takedown of a live listing (e.g. after a scam report). */
export async function takeDownListing(
  actor: SessionUser | null,
  id: string,
  reason: string,
  db: Prisma.TransactionClient = prisma,
) {
  assertRole(actor, "admin");
  const l = await db.listing.findUnique({ where: { id } });
  if (!l) throw notFound("Listing");
  await db.listing.update({ where: { id }, data: { status: "rejected", rejectionReason: reason } });
  await audit(actor.id, "listing.takedown", "listing", id, { reason, from: l.status }, db);
}

// ───────────────────────────── Reports ─────────────────────────────

export async function createReport(
  actor: SessionUser | null,
  input: { listingId: string; reason: Prisma.ReportCreateInput["reason"]; details?: string },
) {
  const listing = await prisma.listing.findFirst({
    where: { id: input.listingId, status: "published" },
    select: { id: true },
  });
  if (!listing) throw notFound("Listing");
  if (actor) {
    const dup = await prisma.report.count({
      where: { listingId: input.listingId, reporterId: actor.id, status: "open" },
    });
    if (dup) throw new AppError("CONFLICT", "You've already reported this listing — our team is reviewing it");
  }
  return prisma.report.create({
    data: { listingId: input.listingId, reporterId: actor?.id ?? null, reason: input.reason, details: input.details },
  });
}

export async function listReports(actor: SessionUser | null, status: "open" | "resolved" | "dismissed" = "open") {
  assertRole(actor, "admin");
  const rows = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: status === "open" ? "asc" : "desc" },
    take: 100,
    include: {
      listing: { select: { id: true, slug: true, title: true, status: true, _count: { select: { reports: true } } } },
      reporter: { select: { fullName: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    resolution: r.resolution,
    createdAt: r.createdAt.toISOString(),
    listing: {
      id: r.listing.id,
      slug: r.listing.slug,
      title: r.listing.title,
      status: r.listing.status,
      totalReports: r.listing._count.reports,
    },
    reporter: r.reporter ? `${r.reporter.fullName} <${r.reporter.email}>` : "Anonymous",
  }));
}

export async function resolveReport(
  actor: SessionUser | null,
  id: string,
  input: { status: "resolved" | "dismissed"; resolution?: string; pauseListing: boolean },
) {
  assertRole(actor, "admin");
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw notFound("Report");
  if (report.status !== "open") throw new AppError("INVALID_STATE", "Report already handled");
  await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id },
      data: { status: input.status, resolution: input.resolution, resolvedBy: actor.id, resolvedAt: new Date() },
    });
    if (input.pauseListing)
      await takeDownListing(actor, report.listingId, `Removed after report: ${input.resolution ?? report.reason}`, tx);
    await audit(actor.id, `report.${input.status}`, "report", id, { takedown: input.pauseListing }, tx);
  });
}

// ──────────────────────── Landlord verification ────────────────────────

export async function requestVerification(actor: SessionUser | null, key: string) {
  assertRole(actor, "landlord", "admin");
  if (!key.startsWith(`private/verification/${actor.id}/`)) throw new AppError("FORBIDDEN", "Invalid document key");
  const { headObject } = await import("../lib/storage");
  if (!(await headObject(key))) throw new AppError("VALIDATION_ERROR", "Upload not found — please try again");
  await prisma.landlordProfile.upsert({
    where: { userId: actor.id },
    update: { verificationStatus: "pending", verificationDocKey: key, verificationNote: null },
    create: { userId: actor.id, verificationStatus: "pending", verificationDocKey: key },
  });
  await audit(actor.id, "verification.request", "user", actor.id);
}

export async function pendingVerifications(actor: SessionUser | null) {
  assertRole(actor, "admin");
  const rows = await prisma.landlordProfile.findMany({
    where: { verificationStatus: "pending" },
    orderBy: { updatedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          createdAt: true,
          _count: { select: { listings: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.fullName,
    email: r.user.email,
    phone: r.user.phone,
    businessName: r.businessName,
    memberSince: r.user.createdAt.toISOString(),
    listings: r.user._count.listings,
    submittedAt: r.updatedAt.toISOString(),
  }));
}

/** Short-lived signed URL to view a private verification document (never public). */
export async function verificationDocumentUrl(actor: SessionUser | null, userId: string) {
  assertRole(actor, "admin");
  const p = await prisma.landlordProfile.findUnique({ where: { userId } });
  if (!p?.verificationDocKey) throw notFound("Document");
  await audit(actor.id, "verification.view_document", "user", userId);
  return presignGet(p.verificationDocKey, 300);
}

export async function decideVerification(
  actor: SessionUser | null,
  userId: string,
  input: { decision: "verified" | "rejected"; note?: string },
) {
  assertRole(actor, "admin");
  const p = await prisma.landlordProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!p) throw notFound("Landlord");
  await prisma.landlordProfile.update({
    where: { userId },
    data: { verificationStatus: input.decision, verificationNote: input.note ?? null },
  });
  if (input.decision === "verified") await prisma.user.update({ where: { id: userId }, data: { isVerified: true } });
  await audit(actor.id, `verification.${input.decision}`, "user", userId, { note: input.note ?? null });
  await sendEmail(
    verificationDecisionEmail(p.user.email, {
      appUrl: env.APP_URL,
      verified: input.decision === "verified",
      note: input.note,
    }),
  );
}

// ─────────────────────────────── Users ───────────────────────────────

export async function listUsers(actor: SessionUser | null, q?: string, role?: Role) {
  assertRole(actor, "admin");
  return prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q
        ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isBanned: true,
      isVerified: true,
      createdAt: true,
      _count: { select: { listings: true, reports: true } },
    },
  });
}

export async function setBanned(actor: SessionUser | null, userId: string, banned: boolean) {
  assertRole(actor, "admin");
  if (userId === actor.id) throw new AppError("INVALID_STATE", "You can't ban yourself");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (user.role === "admin") throw new AppError("INVALID_STATE", "Remove admin rights before banning");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isBanned: banned } });
    // A banned landlord's live listings come down immediately.
    if (banned)
      await tx.listing.updateMany({
        where: { landlordId: userId, status: { in: ["published", "pending_review"] } },
        data: { status: "paused" },
      });
    await audit(actor.id, banned ? "user.ban" : "user.unban", "user", userId, undefined, tx);
  });
}

export async function changeRole(actor: SessionUser | null, userId: string, role: Role) {
  assertRole(actor, "admin");
  if (userId === actor.id) throw new AppError("INVALID_STATE", "You can't change your own role");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      ...(role !== "renter" ? { landlordProfile: { connectOrCreate: { where: { userId }, create: {} } } } : {}),
    },
  });
  await setUserRole(userId, role, user.role, user.cognitoSub);
  await audit(actor.id, "user.set_role", "user", userId, { from: user.role, to: role });
}

// ─────────────────────────── Lookup data ───────────────────────────

export async function createCity(actor: SessionUser | null, input: z.infer<typeof lookupCitySchema>) {
  assertRole(actor, "admin");
  const city = await prisma.city.create({
    data: {
      name: input.name,
      nameNe: input.nameNe,
      slug: slugify(input.name),
      province: input.province,
      district: input.district,
      isActive: input.isActive,
    },
  });
  await prisma.$executeRaw`UPDATE cities SET centroid = ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography WHERE id = ${city.id}`;
  await audit(actor.id, "lookup.city_create", "city", String(city.id));
  revalidateTag("lookups");
  return city;
}

export async function setCityActive(actor: SessionUser | null, id: number, isActive: boolean) {
  assertRole(actor, "admin");
  const city = await prisma.city.update({ where: { id }, data: { isActive } });
  await audit(actor.id, "lookup.city_toggle", "city", String(id), { isActive });
  revalidateTag("lookups");
  return city;
}

export async function createNeighborhood(actor: SessionUser | null, input: z.infer<typeof lookupNeighborhoodSchema>) {
  assertRole(actor, "admin");
  const nb = await prisma.neighborhood.create({
    data: { cityId: input.cityId, name: input.name, nameNe: input.nameNe, slug: slugify(input.name) },
  });
  if (input.latitude != null && input.longitude != null) {
    await prisma.$executeRaw`UPDATE neighborhoods SET centroid = ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography WHERE id = ${nb.id}`;
  }
  await audit(actor.id, "lookup.neighborhood_create", "neighborhood", String(nb.id));
  revalidateTag("lookups");
  return nb;
}

export async function createAmenity(actor: SessionUser | null, input: z.infer<typeof lookupAmenitySchema>) {
  assertRole(actor, "admin");
  const a = await prisma.amenity.create({ data: input });
  await audit(actor.id, "lookup.amenity_create", "amenity", String(a.id));
  revalidateTag("lookups");
  return a;
}

// ───────────────────────── Metrics & audit ─────────────────────────

export async function adminMetrics(actor: SessionUser | null) {
  assertRole(actor, "admin");
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [usersByRole, listingsByStatus, toursByStatus, openReports, pendingVerifications, newUsers, newListings] =
    await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.listing.groupBy({ by: ["status"], _count: true }),
      prisma.tourRequest.groupBy({ by: ["status"], _count: true }),
      prisma.report.count({ where: { status: "open" } }),
      prisma.landlordProfile.count({ where: { verificationStatus: "pending" } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.listing.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);
  const toMap = <T extends { _count: number }>(rows: T[], key: keyof T) =>
    Object.fromEntries(rows.map((r) => [String(r[key]), r._count]));
  return {
    usersByRole: toMap(usersByRole, "role"),
    listingsByStatus: toMap(listingsByStatus, "status"),
    toursByStatus: toMap(toursByStatus, "status"),
    openReports,
    pendingVerifications,
    newUsers7d: newUsers,
    newListings7d: newListings,
  };
}

export async function auditLog(actor: SessionUser | null, limit = 100) {
  assertRole(actor, "admin");
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { fullName: true, email: true } } },
  });
}
