import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { notFound } from "../lib/errors";
import { findBySlug } from "../repositories/listing-repository";
import { similarListingIds } from "../repositories/search-repository";
import { floorPlanDto, photoDto } from "./media-service";
import { publicCoordinates } from "./privacy";
import { search } from "./search-service";

/**
 * Public listing page data. Non-published listings are visible only to their
 * owner and admins (preview). Precise coordinates are withheld when the
 * landlord chose "approximate".
 */
export async function getPublicListing(slug: string, viewer: SessionUser | null) {
  const l = await findBySlug(slug);
  if (!l) throw notFound("Listing");
  const isOwner = viewer?.id === l.landlordId;
  const canPreview = isOwner || viewer?.role === "admin";
  if (l.status !== "published" && !canPreview) throw notFound("Listing");

  if (l.status === "published" && !isOwner) {
    // Fire-and-forget counter; never block rendering on it.
    prisma.listing.update({ where: { id: l.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  }

  const profile = l.landlord.landlordProfile;
  return {
    id: l.id,
    slug: l.slug,
    status: l.status,
    isOwner,
    title: l.title,
    description: l.description,
    propertyType: l.propertyType,
    rentNpr: l.rentNpr,
    depositNpr: l.depositNpr,
    negotiable: l.negotiable,
    availableFrom: l.availableFrom.toISOString().slice(0, 10),
    minLeaseMonths: l.minLeaseMonths,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    areaSqft: l.areaSqft,
    floorNo: l.floorNo,
    totalFloors: l.totalFloors,
    furnishing: l.furnishing,
    parkingBikes: l.parkingBikes,
    parkingCars: l.parkingCars,
    facing: l.facing,
    yearBuilt: l.yearBuilt,
    waterSupply: l.waterSupply,
    electricityBackup: l.electricityBackup,
    internetAvailable: l.internetAvailable,
    wasteCollection: l.wasteCollection,
    gas: l.gas,
    tenantTypes: l.tenantTypes,
    petsAllowed: l.petsAllowed,
    smokingAllowed: l.smokingAllowed,
    city: { id: l.city.id, name: l.city.name, slug: l.city.slug, district: l.city.district, province: l.city.province },
    neighborhood: l.neighborhood ? { name: l.neighborhood.name, slug: l.neighborhood.slug } : null,
    wardNo: l.wardNo,
    landmark: l.landmark,
    // Street address only shown when the landlord opted for an exact location.
    streetAddress: l.locationIsApproximate ? null : l.streetAddress,
    location: publicCoordinates(l.id, l.location?.lat ?? null, l.location?.lng ?? null, l.locationIsApproximate),
    photos: l.photos.filter((p) => p.status === "ready").map(photoDto),
    floorPlans: l.floorPlans.filter((f) => f.status === "ready").map(floorPlanDto),
    amenities: l.amenities.map((a) => ({
      code: a.amenity.code,
      label: a.amenity.label,
      category: a.amenity.category,
      icon: a.amenity.icon,
    })),
    landlord: {
      id: l.landlord.id,
      name: profile?.businessName || l.landlord.fullName,
      memberSince: l.landlord.createdAt.toISOString(),
      verified: profile?.verificationStatus === "verified",
      responseRate: profile?.responseRate ?? null,
    },
    publishedAt: l.publishedAt?.toISOString() ?? null,
    updatedAt: l.updatedAt.toISOString(),
  };
}
export type PublicListing = Awaited<ReturnType<typeof getPublicListing>>;

export async function getSimilarListings(listing: {
  id: string;
  city: { id: number; slug: string };
  rentNpr: number;
  propertyType: string;
}) {
  const ids = await similarListingIds(listing.id, listing.city.id, listing.rentNpr, listing.propertyType);
  if (!ids.length) return [];
  // Reuse the search projection for consistent cards.
  const res = await search({ city: listing.city.slug, sort: "newest", page: 1, limit: 50 });
  const byId = new Map(res.items.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
}
