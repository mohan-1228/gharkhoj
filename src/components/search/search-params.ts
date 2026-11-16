import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import { SORT_OPTIONS } from "@/lib/constants";

/** URL ↔ state parsers. Every filter lives in the URL so searches are shareable and crawlable. */
export const searchParsers = {
  q: parseAsString,
  city: parseAsString,
  neighborhood: parseAsString,
  type: parseAsArrayOf(parseAsString),
  minPrice: parseAsInteger,
  maxPrice: parseAsInteger,
  beds: parseAsInteger,
  baths: parseAsInteger,
  furnishing: parseAsArrayOf(parseAsString),
  amenities: parseAsArrayOf(parseAsString),
  tenant: parseAsArrayOf(parseAsString),
  pets: parseAsBoolean,
  parking: parseAsBoolean,
  availableBy: parseAsString,
  minArea: parseAsInteger,
  maxArea: parseAsInteger,
  bbox: parseAsString,
  lat: parseAsFloat,
  lng: parseAsFloat,
  radiusKm: parseAsFloat,
  sort: parseAsStringLiteral(SORT_OPTIONS),
  page: parseAsInteger,
  view: parseAsStringLiteral(["list", "map"] as const),
};
