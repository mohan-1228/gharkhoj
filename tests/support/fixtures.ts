import type { Role } from "@prisma/client";
import { prisma } from "@/server/lib/db";
import type { SessionUser } from "@/server/auth/types";
import type { CreateListingInput } from "@/schemas/listing";

let n = 0;

/** Remove all non-reference data between tests. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE audit_log, reports, messages, conversations, tour_requests, tour_exceptions, tour_availability,
     saved_searches, favorites, listing_amenities, floor_plans, listing_photos, listings, landlord_profiles, users CASCADE`,
  );
}

export async function createUser(
  role: Role = "renter",
  overrides: Partial<{ email: string; fullName: string }> = {},
): Promise<SessionUser> {
  n++;
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `${role}${n}-${Date.now()}@test.local`,
      fullName: overrides.fullName ?? `Test ${role} ${n}`,
      role,
      ...(role === "landlord" ? { landlordProfile: { create: {} } } : {}),
    },
  });
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

export async function kathmandu() {
  const city = await prisma.city.findUniqueOrThrow({ where: { slug: "kathmandu" }, include: { neighborhoods: true } });
  return {
    city,
    baneshwor: city.neighborhoods.find((x) => x.slug === "baneshwor")!,
    thamel: city.neighborhoods.find((x) => x.slug === "thamel")!,
  };
}

export async function listingInput(overrides: Partial<CreateListingInput> = {}): Promise<CreateListingInput> {
  const { city, baneshwor } = await kathmandu();
  return {
    title: "Bright 2BHK flat near Baneshwor chowk",
    description: "Sunny flat with 24 hour water, parking for two bikes and a quiet lane close to the main road.",
    propertyType: "apartment",
    rentNpr: 30000,
    depositNpr: 60000,
    negotiable: false,
    availableFrom: new Date("2026-12-01"),
    minLeaseMonths: 6,
    bedrooms: 2,
    bathrooms: 1,
    areaSqft: 900,
    floorNo: 2,
    totalFloors: 4,
    furnishing: "semi",
    parkingBikes: 2,
    parkingCars: 0,
    facing: "south",
    yearBuilt: 2015,
    waterSupply: ["municipal", "tank"],
    electricityBackup: "inverter",
    internetAvailable: true,
    wasteCollection: true,
    gas: "lpg",
    tenantTypes: ["family", "professionals"],
    petsAllowed: false,
    smokingAllowed: false,
    cityId: city.id,
    neighborhoodId: baneshwor.id,
    wardNo: 10,
    streetAddress: "Shankhamul Marg",
    landmark: "Behind Everest Bank",
    latitude: 27.6915,
    longitude: 85.342,
    locationIsApproximate: true,
    amenityCodes: ["wifi", "water_24h", "parking"],
    ...overrides,
  };
}

/** Create a listing directly in a given status (bypassing the workflow) for test setup. */
export async function createListingAs(
  landlord: SessionUser,
  overrides: Partial<CreateListingInput> = {},
  status: "draft" | "published" | "pending_review" = "draft",
) {
  const { createDraft } = await import("@/server/services/listing-service");
  const listing = await createDraft(landlord, await listingInput(overrides));
  if (status !== "draft") {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status, publishedAt: status === "published" ? new Date() : null },
    });
  }
  return listing;
}
