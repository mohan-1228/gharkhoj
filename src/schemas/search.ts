import { z } from "zod";
import { FURNISHING, PROPERTY_TYPES, SORT_OPTIONS, TENANT_TYPES } from "@/lib/constants";
import { booleanParam, csv, latitude, longitude } from "./common";

const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().optional());
const optInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(min).max(max).optional());

/**
 * Search filters as they appear in the URL query string. Every filter is
 * optional so any URL is a valid (possibly broader) search.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  city: z.string().max(60).optional(), // city slug
  neighborhood: z.string().max(80).optional(), // neighbourhood slug
  type: csv(z.enum(PROPERTY_TYPES)),
  minPrice: optInt(0, 50_000_000),
  maxPrice: optInt(0, 50_000_000),
  beds: optInt(0, 20), // minimum bedrooms
  baths: optInt(0, 20),
  furnishing: csv(z.enum(FURNISHING)),
  amenities: csv(z.string().max(50)),
  tenant: csv(z.enum(TENANT_TYPES)),
  pets: booleanParam,
  parking: booleanParam,
  availableBy: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional()),
  minArea: optInt(0, 1_000_000),
  maxArea: optInt(0, 1_000_000),
  // Geo: bounding box "south,west,north,east" or radius search around lat/lng.
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
  radiusKm: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(0.2).max(50).optional()),
  ids: z.array(z.string().uuid()).max(100).optional(), // internal use (favorites, similar)
  sort: z.enum(SORT_OPTIONS).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export function parseBbox(bbox: string): { south: number; west: number; north: number; east: number } {
  const [south, west, north, east] = bbox.split(",").map(Number) as [number, number, number, number];
  return { south, west, north, east };
}

export { optNum };
