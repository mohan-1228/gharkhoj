import type { SearchQuery } from "@/schemas/search";
import { mediaUrl } from "../lib/storage";
import { mapPins, searchListings, type SearchRow } from "../repositories/search-repository";
import { publicCoordinates } from "./privacy";

export function toCard(r: SearchRow) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    propertyType: r.property_type,
    rentNpr: r.rent_npr,
    depositNpr: r.deposit_npr,
    negotiable: r.negotiable,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    areaSqft: r.area_sqft,
    furnishing: r.furnishing,
    availableFrom: r.available_from.toISOString().slice(0, 10),
    publishedAt: r.published_at?.toISOString() ?? null,
    city: { name: r.city_name, slug: r.city_slug },
    neighborhood: r.neighborhood_name ? { name: r.neighborhood_name, slug: r.neighborhood_slug } : null,
    location: publicCoordinates(r.id, r.lat, r.lng, r.location_is_approximate),
    image: r.cover_media_key ? { sm: mediaUrl(r.cover_media_key, 320), md: mediaUrl(r.cover_media_key, 640) } : null,
    photoCount: r.photo_count,
    landlordVerified: r.landlord_verified,
    distanceKm: r.distance_m != null ? Math.round(r.distance_m / 100) / 10 : null,
  };
}
export type ListingCardData = ReturnType<typeof toCard>;

export async function search(q: SearchQuery) {
  const { rows, total } = await searchListings(q);
  const pages = Math.max(1, Math.ceil(total / q.limit));
  return {
    items: rows.map(toCard),
    total,
    page: q.page,
    pageSize: q.limit,
    pages,
    nextCursor: q.page < pages ? String(q.page + 1) : null,
  };
}
export type SearchResult = Awaited<ReturnType<typeof search>>;

export async function searchMap(q: SearchQuery) {
  const rows = await mapPins(q);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    rentNpr: r.rent_npr,
    bedrooms: r.bedrooms,
    propertyType: r.property_type,
    location: publicCoordinates(r.id, r.lat, r.lng, r.location_is_approximate)!,
    image: r.cover_media_key ? mediaUrl(r.cover_media_key, 320) : null,
  }));
}
export type MapPin = Awaited<ReturnType<typeof searchMap>>[number];
