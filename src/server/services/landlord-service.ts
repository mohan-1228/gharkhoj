import { assertRole } from "../auth/guards";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";

/** Landlord dashboard numbers (GET /api/v1/landlord/stats). */
export async function landlordStats(actor: SessionUser | null) {
  assertRole(actor, "landlord", "admin");
  const [byStatus, totals, favorites, pendingTours, upcomingTours, profile] = await Promise.all([
    prisma.listing.groupBy({ by: ["status"], where: { landlordId: actor.id }, _count: true }),
    prisma.listing.aggregate({ where: { landlordId: actor.id }, _sum: { viewCount: true } }),
    prisma.favorite.count({ where: { listing: { landlordId: actor.id } } }),
    prisma.tourRequest.count({ where: { listing: { landlordId: actor.id }, status: "requested" } }),
    prisma.tourRequest.count({
      where: { listing: { landlordId: actor.id }, status: "confirmed", confirmedSlot: { gte: new Date() } },
    }),
    prisma.landlordProfile.findUnique({ where: { userId: actor.id } }),
  ]);
  return {
    listingsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Record<string, number>,
    totalViews: totals._sum.viewCount ?? 0,
    totalFavorites: favorites,
    pendingTourRequests: pendingTours,
    upcomingTours,
    verificationStatus: profile?.verificationStatus ?? "unverified",
  };
}
