import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { slugify } from "@/lib/format";
import type { CreateListingInput, ListingStatusAction, UpdateListingInput } from "@/schemas/listing";
import { assertOwnerOrAdmin, assertRole } from "../auth/guards";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { AppError, notFound } from "../lib/errors";
import * as repo from "../repositories/listing-repository";
import { audit } from "./audit";
import { collectListingObjectKeys } from "./media-service";
import { deleteObjects } from "../lib/storage";
import { logger } from "../lib/logger";
import { rateLimit } from "../lib/rate-limit";
import { nextStatus, REVIEW_SENSITIVE_FIELDS, type ListingTransition } from "./listing-state";

function makeSlug(title: string): string {
  return `${slugify(title) || "listing"}-${randomBytes(3).toString("hex")}`;
}

/** Split validated input into Prisma columns vs. side tables (location, amenities). */
function toColumns(input: UpdateListingInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip non-column fields
  const { amenityCodes, latitude, longitude, cityId, neighborhoodId, ...rest } = input;
  const data: Prisma.ListingUncheckedUpdateInput = { ...rest };
  if (cityId !== undefined) data.cityId = cityId;
  if (neighborhoodId !== undefined) data.neighborhoodId = neighborhoodId ?? null;
  return data;
}

async function assertNeighborhoodInCity(db: repo.Db, cityId: number, neighborhoodId: number | null | undefined) {
  if (neighborhoodId == null) return;
  const nb = await db.neighborhood.findUnique({ where: { id: neighborhoodId }, select: { cityId: true } });
  if (!nb || nb.cityId !== cityId) {
    throw new AppError("VALIDATION_ERROR", "Neighbourhood does not belong to the selected city", {
      fields: [{ path: "neighborhoodId", message: "Choose a neighbourhood in the selected city" }],
    });
  }
}

export async function createDraft(actor: SessionUser | null, input: CreateListingInput) {
  assertRole(actor, "landlord", "admin");
  rateLimit(`listing-create:${actor.id}`, 20, 60 * 60_000); // spam guard

  return prisma.$transaction(async (tx) => {
    const city = await tx.city.findFirst({ where: { id: input.cityId, isActive: true } });
    if (!city)
      throw new AppError("VALIDATION_ERROR", "Unknown city", {
        fields: [{ path: "cityId", message: "Choose a city" }],
      });
    await assertNeighborhoodInCity(tx, input.cityId, input.neighborhoodId);

    const listing = await tx.listing.create({
      data: {
        ...(toColumns(input) as Prisma.ListingUncheckedCreateInput),
        cityId: input.cityId,
        landlordId: actor.id,
        slug: makeSlug(input.title),
        status: "draft",
      },
    });
    await repo.replaceAmenities(tx, listing.id, await repo.amenityIdsForCodes(tx, input.amenityCodes));
    await repo.setLocation(tx, listing.id, input.latitude ?? null, input.longitude ?? null);
    await audit(actor.id, "listing.create", "listing", listing.id, undefined, tx);
    return listing;
  });
}

async function loadOwned(actor: SessionUser, id: string, db: repo.Db = prisma) {
  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) throw notFound("Listing");
  assertOwnerOrAdmin(actor, listing.landlordId);
  return listing;
}

export async function updateListing(actor: SessionUser | null, id: string, input: UpdateListingInput) {
  assertRole(actor, "landlord", "admin");
  return prisma.$transaction(async (tx) => {
    const existing = await loadOwned(actor, id, tx);
    if (existing.status === "archived")
      throw new AppError("INVALID_STATE", "Relist an archived listing before editing it");

    const cityId = input.cityId ?? existing.cityId;
    if (input.neighborhoodId !== undefined || input.cityId !== undefined) {
      await assertNeighborhoodInCity(
        tx,
        cityId,
        input.neighborhoodId === undefined ? existing.neighborhoodId : input.neighborhoodId,
      );
    }
    if (input.floorNo != null && input.totalFloors != null && input.floorNo > input.totalFloors) {
      throw new AppError("VALIDATION_ERROR", "Floor cannot be above the total floors", {
        fields: [{ path: "floorNo", message: "Floor cannot be above the total floors" }],
      });
    }

    const data = toColumns(input);
    // Changing the headline content of a live listing sends it back to moderation.
    const sensitiveChange = REVIEW_SENSITIVE_FIELDS.some((f) => input[f] !== undefined && input[f] !== existing[f]);
    if (existing.status === "published" && sensitiveChange && actor.role !== "admin") {
      data.status = "pending_review";
    }
    if (existing.status === "rejected") data.rejectionReason = null;

    const updated = await tx.listing.update({ where: { id }, data });
    if (input.amenityCodes) await repo.replaceAmenities(tx, id, await repo.amenityIdsForCodes(tx, input.amenityCodes));
    if (input.latitude !== undefined || input.longitude !== undefined) {
      await repo.setLocation(tx, id, input.latitude ?? null, input.longitude ?? null);
    }
    await audit(actor.id, "listing.update", "listing", id, { requeued: data.status === "pending_review" }, tx);
    return updated;
  });
}

export async function deleteListing(actor: SessionUser | null, id: string) {
  assertRole(actor, "landlord", "admin");
  const listing = await loadOwned(actor, id);
  const keys = await collectListingObjectKeys(id);
  await prisma.listing.delete({ where: { id: listing.id } });
  await audit(actor.id, "listing.delete", "listing", id, { title: listing.title });
  // Best effort: orphaned objects are also swept by the S3 lifecycle rule on uploads/.
  await deleteObjects(keys).catch((err) => logger.warn({ err, listingId: id }, "S3 cleanup after delete failed"));
  return listing;
}

/** Owner submits a draft/rejected listing for moderation. */
export async function submitForReview(actor: SessionUser | null, id: string) {
  assertRole(actor, "landlord", "admin");
  const listing = await loadOwned(actor, id);
  const status = nextStatus(listing.status, "submit");
  await assertSubmittable(id);
  const updated = await repo.updateStatus(prisma, id, status, { rejectionReason: null });
  await audit(actor.id, "listing.submit", "listing", id);
  return updated;
}

/** Minimum quality bar before a listing enters the moderation queue. */
export async function assertSubmittable(id: string) {
  const problems: string[] = [];
  const loc = (await repo.getLocations(prisma, [id])).get(id);
  if (!loc) problems.push("Place the property on the map");
  const readyPhotos = await prisma.listingPhoto.count({ where: { listingId: id, status: "ready" } });
  if (readyPhotos === 0) problems.push("Add at least one photo");
  if (problems.length) throw new AppError("INVALID_STATE", "Listing is not ready to submit", { problems });
}

const OWNER_ACTION_MAP: Record<ListingStatusAction, ListingTransition> = {
  pause: "pause",
  resume: "resume",
  mark_rented: "mark_rented",
  archive: "archive",
  relist: "relist",
};

export async function changeStatus(actor: SessionUser | null, id: string, action: ListingStatusAction) {
  assertRole(actor, "landlord", "admin");
  const listing = await loadOwned(actor, id);
  const status = nextStatus(listing.status, OWNER_ACTION_MAP[action]);
  const updated = await repo.updateStatus(prisma, id, status);
  await audit(actor.id, `listing.${action}`, "listing", id, { from: listing.status, to: status });
  return updated;
}

export async function getListingForEdit(actor: SessionUser | null, id: string) {
  assertRole(actor, "landlord", "admin");
  const listing = await repo.findById(id);
  if (!listing) throw notFound("Listing");
  assertOwnerOrAdmin(actor, listing.landlordId);
  return listing;
}

export async function listLandlordListings(actor: SessionUser | null) {
  assertRole(actor, "landlord", "admin");
  return repo.listByLandlord(actor.id);
}

/** Copy a listing (without photos) into a new draft — "duplicate listing" action. */
export async function duplicateListing(actor: SessionUser | null, id: string) {
  assertRole(actor, "landlord", "admin");
  const src = await repo.findById(id);
  if (!src) throw notFound("Listing");
  assertOwnerOrAdmin(actor, src.landlordId);
  return createDraft(actor, {
    title: `${src.title} (copy)`.slice(0, 120),
    description: src.description,
    propertyType: src.propertyType,
    rentNpr: src.rentNpr,
    depositNpr: src.depositNpr ?? undefined,
    negotiable: src.negotiable,
    availableFrom: src.availableFrom,
    minLeaseMonths: src.minLeaseMonths,
    bedrooms: src.bedrooms,
    bathrooms: src.bathrooms,
    areaSqft: src.areaSqft ?? undefined,
    floorNo: src.floorNo ?? undefined,
    totalFloors: src.totalFloors ?? undefined,
    furnishing: src.furnishing,
    parkingBikes: src.parkingBikes,
    parkingCars: src.parkingCars,
    facing: src.facing,
    yearBuilt: src.yearBuilt ?? undefined,
    waterSupply: src.waterSupply as CreateListingInput["waterSupply"],
    electricityBackup: src.electricityBackup,
    internetAvailable: src.internetAvailable,
    wasteCollection: src.wasteCollection,
    gas: src.gas,
    tenantTypes: src.tenantTypes as CreateListingInput["tenantTypes"],
    petsAllowed: src.petsAllowed,
    smokingAllowed: src.smokingAllowed,
    cityId: src.cityId,
    neighborhoodId: src.neighborhoodId,
    wardNo: src.wardNo ?? undefined,
    streetAddress: src.streetAddress,
    landmark: src.landmark,
    latitude: src.location?.lat ?? null,
    longitude: src.location?.lng ?? null,
    locationIsApproximate: src.locationIsApproximate,
    amenityCodes: src.amenities.map((a) => a.amenity.code),
  });
}
