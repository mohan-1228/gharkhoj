import { z } from "zod";
import {
  ELECTRICITY_BACKUP,
  FACING,
  FURNISHING,
  GAS_SUPPLY,
  PROPERTY_TYPES,
  TENANT_TYPES,
  WATER_SUPPLY,
} from "@/lib/constants";
import { latitude, longitude } from "./common";

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : v),
    z.coerce.number().int().min(min).max(max).optional(),
  );

/**
 * Fields a landlord edits. Shared by the listing form (client) and
 * POST/PATCH /api/v1/listings (server).
 */
export const listingFieldsSchema = z.object({
  title: z.string().trim().min(10, "Title should be at least 10 characters").max(120),
  description: z.string().trim().min(30, "Describe the place in at least 30 characters").max(5000),
  propertyType: z.enum(PROPERTY_TYPES),

  rentNpr: z.coerce.number().int("Rent must be a whole number").min(500, "Rent looks too low").max(10_000_000),
  depositNpr: optionalInt(0, 50_000_000),
  negotiable: z.boolean().default(false),
  availableFrom: z.coerce.date(),
  minLeaseMonths: z.coerce.number().int().min(1).max(60).default(1),

  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
  areaSqft: optionalInt(20, 500_000),
  floorNo: optionalInt(-3, 60),
  totalFloors: optionalInt(1, 60),
  furnishing: z.enum(FURNISHING).default("unfurnished"),
  parkingBikes: z.coerce.number().int().min(0).max(50).default(0),
  parkingCars: z.coerce.number().int().min(0).max(50).default(0),
  facing: z.enum(FACING).optional().nullable(),
  yearBuilt: optionalInt(1900, 2100),

  waterSupply: z.array(z.enum(WATER_SUPPLY)).default([]),
  electricityBackup: z.enum(ELECTRICITY_BACKUP).default("none"),
  internetAvailable: z.boolean().default(false),
  wasteCollection: z.boolean().default(false),
  gas: z.enum(GAS_SUPPLY).default("none"),

  tenantTypes: z.array(z.enum(TENANT_TYPES)).default([]),
  petsAllowed: z.boolean().default(false),
  smokingAllowed: z.boolean().default(false),

  cityId: z.coerce.number().int().positive("Choose a city"),
  neighborhoodId: optionalInt(1, Number.MAX_SAFE_INTEGER).nullable(),
  wardNo: optionalInt(1, 40),
  streetAddress: z.string().trim().max(200).optional().nullable(),
  landmark: z.string().trim().max(200).optional().nullable(),
  latitude: latitude.optional().nullable(),
  longitude: longitude.optional().nullable(),
  locationIsApproximate: z.boolean().default(true),

  amenityCodes: z.array(z.string().max(50)).max(80).default([]),
});

export const createListingSchema = listingFieldsSchema.superRefine((v, ctx) => {
  if (v.floorNo !== undefined && v.totalFloors !== undefined && v.floorNo > v.totalFloors) {
    ctx.addIssue({ code: "custom", path: ["floorNo"], message: "Floor cannot be above the total floors" });
  }
  if ((v.latitude == null) !== (v.longitude == null)) {
    ctx.addIssue({ code: "custom", path: ["latitude"], message: "Both latitude and longitude are required" });
  }
});
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingFormValues = z.input<typeof listingFieldsSchema>;

export const updateListingSchema = listingFieldsSchema.partial();
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

/** Owner-initiated status changes (submit for review is a separate endpoint). */
export const listingStatusActionSchema = z.object({
  action: z.enum(["pause", "resume", "mark_rented", "archive", "relist"]),
});
export type ListingStatusAction = z.infer<typeof listingStatusActionSchema>["action"];

export const registerPhotoSchema = z.object({
  key: z.string().min(1).max(500),
  caption: z.string().trim().max(200).optional(),
  roomLabel: z.string().trim().max(60).optional(),
});

export const updatePhotosSchema = z.object({
  photos: z
    .array(
      z.object({
        id: z.string().uuid(),
        caption: z.string().trim().max(200).optional().nullable(),
        roomLabel: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .max(25),
  coverId: z.string().uuid().optional(),
});

export const registerFloorPlanSchema = z.object({
  key: z.string().min(1).max(500),
  label: z.string().trim().max(80).optional(),
});
