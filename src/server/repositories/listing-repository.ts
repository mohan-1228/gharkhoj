import { type Prisma, type ListingStatus } from "@prisma/client";
import { prisma } from "../lib/db";

/**
 * Listing persistence. PostGIS columns are written/read with parameterised raw
 * SQL (tagged templates — never string concatenation) per CLAUDE.md §9.
 */
export type Db = Prisma.TransactionClient | typeof prisma;

export const listingDetailInclude = {
  city: true,
  neighborhood: true,
  amenities: { include: { amenity: true } },
  photos: { orderBy: { sortOrder: "asc" } },
  floorPlans: { orderBy: { sortOrder: "asc" } },
  landlord: { select: { id: true, fullName: true, createdAt: true, landlordProfile: true } },
} satisfies Prisma.ListingInclude;

export type ListingWithRelations = Prisma.ListingGetPayload<{ include: typeof listingDetailInclude }>;

export async function setLocation(db: Db, listingId: string, lat: number | null, lng: number | null): Promise<void> {
  if (lat == null || lng == null) {
    await db.$executeRaw`UPDATE listings SET location = NULL WHERE id = ${listingId}::uuid`;
    return;
  }
  await db.$executeRaw`
    UPDATE listings
       SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
     WHERE id = ${listingId}::uuid`;
}

export async function getLocations(db: Db, ids: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  if (ids.length === 0) return new Map();
  const rows = await db.$queryRaw<{ id: string; lat: number; lng: number }[]>`
    SELECT id::text, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM listings
     WHERE id = ANY(${ids}::uuid[]) AND location IS NOT NULL`;
  return new Map(rows.map((r) => [r.id, { lat: r.lat, lng: r.lng }]));
}

export async function findById(id: string, db: Db = prisma) {
  const listing = await db.listing.findUnique({ where: { id }, include: listingDetailInclude });
  if (!listing) return null;
  const loc = (await getLocations(db, [id])).get(id) ?? null;
  return { ...listing, location: loc };
}

export async function findBySlug(slug: string, db: Db = prisma) {
  const listing = await db.listing.findUnique({ where: { slug }, include: listingDetailInclude });
  if (!listing) return null;
  const loc = (await getLocations(db, [listing.id])).get(listing.id) ?? null;
  return { ...listing, location: loc };
}

export async function amenityIdsForCodes(db: Db, codes: string[]): Promise<number[]> {
  if (codes.length === 0) return [];
  const rows = await db.amenity.findMany({ where: { code: { in: codes } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function replaceAmenities(db: Db, listingId: string, amenityIds: number[]): Promise<void> {
  await db.listingAmenity.deleteMany({ where: { listingId } });
  if (amenityIds.length) {
    await db.listingAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ listingId, amenityId })),
      skipDuplicates: true,
    });
  }
}

export async function listByLandlord(landlordId: string) {
  return prisma.listing.findMany({
    where: { landlordId },
    orderBy: { updatedAt: "desc" },
    include: {
      city: { select: { name: true } },
      neighborhood: { select: { name: true } },
      photos: { where: { isCover: true }, take: 1 },
      _count: { select: { favorites: true, tourRequests: { where: { status: "requested" } } } },
    },
  });
}

export async function updateStatus(db: Db, id: string, status: ListingStatus, extra: Prisma.ListingUpdateInput = {}) {
  return db.listing.update({ where: { id }, data: { status, ...extra } });
}
