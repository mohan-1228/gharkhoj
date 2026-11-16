import { describe, expect, it } from "vitest";
import { createListingSchema } from "@/schemas/listing";

const base = {
  title: "Cozy studio flat in Thamel",
  description: "A cozy studio flat with attached bathroom, close to restaurants and the Garden of Dreams.",
  propertyType: "studio_flat",
  rentNpr: "18000",
  availableFrom: "2026-12-01",
  bedrooms: "1",
  bathrooms: "1",
  cityId: "1",
};

describe("createListingSchema", () => {
  it("coerces form strings into typed values and applies defaults", () => {
    const v = createListingSchema.parse(base);
    expect(v.rentNpr).toBe(18000);
    expect(v.availableFrom).toBeInstanceOf(Date);
    expect(v.furnishing).toBe("unfurnished");
    expect(v.tenantTypes).toEqual([]);
    expect(v.depositNpr).toBeUndefined();
  });

  it("treats empty optional number inputs as undefined", () => {
    const v = createListingSchema.parse({ ...base, areaSqft: "", depositNpr: "" });
    expect(v.areaSqft).toBeUndefined();
    expect(v.depositNpr).toBeUndefined();
  });

  it("stores money as integers only", () => {
    expect(createListingSchema.safeParse({ ...base, rentNpr: "18000.50" }).success).toBe(false);
  });

  it("rejects a floor above the building height", () => {
    const r = createListingSchema.safeParse({ ...base, floorNo: 5, totalFloors: 3 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["floorNo"]);
  });

  it("requires both coordinates and keeps them inside Nepal", () => {
    expect(createListingSchema.safeParse({ ...base, latitude: 27.7 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, latitude: 40.7, longitude: -74 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, latitude: 27.7, longitude: 85.3 }).success).toBe(true);
  });
});
