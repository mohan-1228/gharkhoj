import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/db";
import { searchQuerySchema } from "@/schemas/search";
import { search, searchMap } from "@/server/services/search-service";
import { createListingAs, createUser, kathmandu, resetDb } from "../support/fixtures";

const q = (input: Record<string, unknown>) => searchQuerySchema.parse(input);

describe("search", () => {
  beforeAll(async () => {
    await resetDb();
    const owner = await createUser("landlord");
    const { thamel } = await kathmandu();
    const pokhara = await prisma.city.findUniqueOrThrow({ where: { slug: "pokhara" } });
    await createListingAs(
      owner,
      {
        title: "Cheap room near Baneshwor chowk",
        propertyType: "room",
        rentNpr: 8000,
        bedrooms: 1,
        amenityCodes: ["wifi"],
        tenantTypes: ["students"],
      },
      "published",
    );
    await createListingAs(
      owner,
      {
        title: "Family apartment with balcony",
        rentNpr: 45000,
        bedrooms: 3,
        petsAllowed: true,
        amenityCodes: ["wifi", "parking"],
        tenantTypes: ["family"],
      },
      "published",
    );
    await createListingAs(
      owner,
      {
        title: "Studio flat in the heart of Thamel",
        propertyType: "studio_flat",
        rentNpr: 20000,
        neighborhoodId: thamel.id,
        latitude: 27.7154,
        longitude: 85.3123,
        furnishing: "fully",
        amenityCodes: [],
      },
      "published",
    );
    await createListingAs(
      owner,
      {
        title: "Lakeside flat with mountain view",
        cityId: pokhara.id,
        neighborhoodId: null,
        latitude: 28.21,
        longitude: 83.96,
        rentNpr: 25000,
        amenityCodes: [],
      },
      "published",
    );
    await createListingAs(owner, { title: "Draft listing should never appear", rentNpr: 1000 }, "draft");
  });

  it("only returns published listings", async () => {
    const r = await search(q({}));
    expect(r.total).toBe(4);
    expect(r.items.some((i) => i.title.startsWith("Draft"))).toBe(false);
  });

  it("filters by city, type, price, beds", async () => {
    expect((await search(q({ city: "pokhara" }))).items.map((i) => i.title)).toEqual([
      "Lakeside flat with mountain view",
    ]);
    expect((await search(q({ type: "room,studio_flat" }))).total).toBe(2);
    expect((await search(q({ minPrice: 15000, maxPrice: 30000 }))).total).toBe(2);
    expect((await search(q({ beds: 3 }))).items[0]?.title).toBe("Family apartment with balcony");
  });

  it("requires ALL selected amenities and overlaps tenant types", async () => {
    expect((await search(q({ amenities: "wifi" }))).total).toBe(2);
    expect((await search(q({ amenities: "wifi,parking" }))).total).toBe(1);
    expect((await search(q({ tenant: "students,couples" }))).items[0]?.title).toContain("Cheap room");
  });

  it("supports boolean filters and furnishing", async () => {
    expect((await search(q({ pets: "true" }))).total).toBe(1);
    expect((await search(q({ furnishing: "fully" }))).items[0]?.title).toContain("Thamel");
  });

  it("full-text and fuzzy keyword search", async () => {
    expect((await search(q({ q: "balcony" }))).items[0]?.title).toBe("Family apartment with balcony");
    expect((await search(q({ q: "thamel" }))).total).toBe(1); // matches neighbourhood name
  });

  it("radius search with nearest sort", async () => {
    const r = await search(q({ lat: 27.7154, lng: 85.3123, radiusKm: 1, sort: "nearest" }));
    expect(r.items.map((i) => i.title)).toEqual(["Studio flat in the heart of Thamel"]);
    expect(r.items[0]?.distanceKm).toBe(0);
  });

  it("bounding-box map pins", async () => {
    const valley = await searchMap(q({ bbox: "27.6,85.2,27.8,85.45" }));
    expect(valley).toHaveLength(3);
    const pokhara = await searchMap(q({ bbox: "28.1,83.9,28.3,84.1" }));
    expect(pokhara).toHaveLength(1);
  });

  it("sorts by price and paginates", async () => {
    const asc = await search(q({ sort: "price_asc", limit: 2 }));
    expect(asc.items.map((i) => i.rentNpr)).toEqual([8000, 20000]);
    expect(asc.pages).toBe(2);
    expect(asc.nextCursor).toBe("2");
    const page2 = await search(q({ sort: "price_asc", limit: 2, page: 2 }));
    expect(page2.items.map((i) => i.rentNpr)).toEqual([25000, 45000]);
    expect(page2.nextCursor).toBeNull();
  });
});
