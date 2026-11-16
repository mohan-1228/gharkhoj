import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/db";
import * as listings from "@/server/services/listing-service";
import { findById } from "@/server/repositories/listing-repository";
import { createListingAs, createUser, kathmandu, listingInput, resetDb } from "../support/fixtures";

describe("listing service", () => {
  beforeEach(resetDb);

  it("creates a draft with amenities and a PostGIS location", async () => {
    const landlord = await createUser("landlord");
    const created = await listings.createDraft(landlord, await listingInput());
    const l = await findById(created.id);
    expect(l?.status).toBe("draft");
    expect(l?.slug).toMatch(/^bright-2bhk-flat-near-baneshwor-chowk-[0-9a-f]{6}$/);
    expect(l?.amenities.map((a) => a.amenity.code).sort()).toEqual(["parking", "water_24h", "wifi"]);
    expect(l?.location?.lat).toBeCloseTo(27.6915, 4);
    expect(l?.location?.lng).toBeCloseTo(85.342, 4);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: created.id } });
    expect(audit?.action).toBe("listing.create");
  });

  it("forbids renters from creating listings", async () => {
    const renter = await createUser("renter");
    await expect(listings.createDraft(renter, await listingInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a neighbourhood from another city", async () => {
    const landlord = await createUser("landlord");
    const pokhara = await prisma.city.findUniqueOrThrow({ where: { slug: "pokhara" } });
    const { baneshwor } = await kathmandu();
    await expect(
      listings.createDraft(landlord, await listingInput({ cityId: pokhara.id, neighborhoodId: baneshwor.id })),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("only lets the owner (or an admin) edit", async () => {
    const owner = await createUser("landlord");
    const other = await createUser("landlord");
    const admin = await createUser("admin");
    const l = await createListingAs(owner);
    await expect(listings.updateListing(other, l.id, { rentNpr: 1000 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listings.updateListing(admin, l.id, { rentNpr: 32000 })).resolves.toMatchObject({ rentNpr: 32000 });
  });

  it("sends a published listing back to review when its title changes", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner, {}, "published");
    const priceOnly = await listings.updateListing(owner, l.id, { rentNpr: 28000 });
    expect(priceOnly.status).toBe("published");
    const retitled = await listings.updateListing(owner, l.id, { title: "Completely different title for this flat" });
    expect(retitled.status).toBe("pending_review");
  });

  it("enforces the lifecycle on status changes", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner);
    await expect(listings.changeStatus(owner, l.id, "pause")).rejects.toMatchObject({ code: "INVALID_STATE" });
    await prisma.listing.update({ where: { id: l.id }, data: { status: "published" } });
    expect((await listings.changeStatus(owner, l.id, "mark_rented")).status).toBe("rented");
    expect((await listings.changeStatus(owner, l.id, "relist")).status).toBe("draft");
  });

  it("duplicates a listing into a new draft", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner, {}, "published");
    const copy = await listings.duplicateListing(owner, l.id);
    expect(copy.id).not.toBe(l.id);
    expect(copy.status).toBe("draft");
    expect(copy.title).toContain("(copy)");
  });

  it("deletes with cascade", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner);
    await listings.deleteListing(owner, l.id);
    expect(await prisma.listing.findUnique({ where: { id: l.id } })).toBeNull();
    expect(await prisma.listingAmenity.count({ where: { listingId: l.id } })).toBe(0);
  });
});
