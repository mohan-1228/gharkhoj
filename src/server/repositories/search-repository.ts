import { Prisma } from "@prisma/client";
import { parseBbox, type SearchQuery } from "@/schemas/search";
import { prisma } from "../lib/db";

/**
 * Public listing search. All values are bound parameters via Prisma.sql
 * fragments — no string concatenation of user input (CLAUDE.md §9).
 *
 * Index usage: partial index on published rows (city, rent), GiST on location
 * for bbox/radius, GIN on search_vector for text, GIN on tenant_types for overlap.
 */
export interface SearchRow {
  id: string;
  slug: string;
  title: string;
  property_type: string;
  rent_npr: number;
  deposit_npr: number | null;
  negotiable: boolean;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number | null;
  furnishing: string;
  available_from: Date;
  published_at: Date | null;
  city_name: string;
  city_slug: string;
  neighborhood_name: string | null;
  neighborhood_slug: string | null;
  lat: number | null;
  lng: number | null;
  location_is_approximate: boolean;
  cover_media_key: string | null;
  photo_count: number;
  landlord_verified: boolean;
  distance_m: number | null;
  total: bigint;
}

function whereClauses(q: SearchQuery): Prisma.Sql[] {
  const w: Prisma.Sql[] = [Prisma.sql`l.status = 'published'`];
  if (q.ids) w.push(Prisma.sql`l.id = ANY(${q.ids}::uuid[])`);
  if (q.city) w.push(Prisma.sql`c.slug = ${q.city}`);
  if (q.neighborhood) w.push(Prisma.sql`n.slug = ${q.neighborhood}`);
  if (q.type?.length) w.push(Prisma.sql`l.property_type::text = ANY(${q.type}::text[])`);
  if (q.minPrice != null) w.push(Prisma.sql`l.rent_npr >= ${q.minPrice}`);
  if (q.maxPrice != null) w.push(Prisma.sql`l.rent_npr <= ${q.maxPrice}`);
  if (q.beds != null) w.push(Prisma.sql`l.bedrooms >= ${q.beds}`);
  if (q.baths != null) w.push(Prisma.sql`l.bathrooms >= ${q.baths}`);
  if (q.furnishing?.length) w.push(Prisma.sql`l.furnishing::text = ANY(${q.furnishing}::text[])`);
  if (q.tenant?.length) w.push(Prisma.sql`l.tenant_types && ${q.tenant}::text[]`);
  if (q.pets) w.push(Prisma.sql`l.pets_allowed = true`);
  if (q.parking) w.push(Prisma.sql`(l.parking_bikes + l.parking_cars) > 0`);
  if (q.availableBy) w.push(Prisma.sql`l.available_from <= ${q.availableBy}::date`);
  if (q.minArea != null) w.push(Prisma.sql`l.area_sqft >= ${q.minArea}`);
  if (q.maxArea != null) w.push(Prisma.sql`l.area_sqft <= ${q.maxArea}`);
  if (q.amenities?.length) {
    // Listing must have ALL requested amenities.
    w.push(Prisma.sql`(
      SELECT COUNT(*) FROM listing_amenities la JOIN amenities a ON a.id = la.amenity_id
       WHERE la.listing_id = l.id AND a.code = ANY(${q.amenities}::text[])
    ) = ${q.amenities.length}`);
  }
  if (q.bbox) {
    const b = parseBbox(q.bbox);
    w.push(Prisma.sql`l.location && ST_MakeEnvelope(${b.west}, ${b.south}, ${b.east}, ${b.north}, 4326)::geography`);
  }
  if (q.lat != null && q.lng != null && q.radiusKm != null) {
    w.push(
      Prisma.sql`ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography, ${q.radiusKm * 1000})`,
    );
  }
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    w.push(Prisma.sql`(
      l.search_vector @@ websearch_to_tsquery('simple', ${q.q})
      OR n.name ILIKE ${like} OR c.name ILIKE ${like} OR l.title ILIKE ${like} OR l.landmark ILIKE ${like}
    )`);
  }
  return w;
}

function orderBy(q: SearchQuery): Prisma.Sql {
  switch (q.sort) {
    case "price_asc":
      return Prisma.sql`l.rent_npr ASC, l.published_at DESC`;
    case "price_desc":
      return Prisma.sql`l.rent_npr DESC, l.published_at DESC`;
    case "relevance":
      return q.q
        ? Prisma.sql`ts_rank(l.search_vector, websearch_to_tsquery('simple', ${q.q})) DESC, l.published_at DESC`
        : Prisma.sql`l.view_count DESC, l.published_at DESC`;
    case "nearest":
      return q.lat != null && q.lng != null ? Prisma.sql`distance_m ASC NULLS LAST` : Prisma.sql`l.published_at DESC`;
    default:
      return Prisma.sql`l.published_at DESC NULLS LAST, l.id`;
  }
}

export async function searchListings(q: SearchQuery): Promise<{ rows: SearchRow[]; total: number }> {
  const where = Prisma.join(whereClauses(q), " AND ");
  const distance =
    q.lat != null && q.lng != null
      ? Prisma.sql`ST_Distance(l.location, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography)`
      : Prisma.sql`NULL::float8`;
  const offset = (q.page - 1) * q.limit;

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT l.id::text, l.slug, l.title, l.property_type::text, l.rent_npr, l.deposit_npr, l.negotiable,
           l.bedrooms, l.bathrooms, l.area_sqft, l.furnishing::text, l.available_from, l.published_at,
           c.name AS city_name, c.slug AS city_slug, n.name AS neighborhood_name, n.slug AS neighborhood_slug,
           ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng, l.location_is_approximate,
           (SELECT p.media_key FROM listing_photos p WHERE p.listing_id = l.id AND p.status = 'ready'
             ORDER BY p.is_cover DESC, p.sort_order LIMIT 1) AS cover_media_key,
           (SELECT COUNT(*)::int FROM listing_photos p WHERE p.listing_id = l.id AND p.status = 'ready') AS photo_count,
           COALESCE(lp.verification_status = 'verified', false) AS landlord_verified,
           ${distance} AS distance_m,
           COUNT(*) OVER() AS total
      FROM listings l
      JOIN cities c ON c.id = l.city_id
      LEFT JOIN neighborhoods n ON n.id = l.neighborhood_id
      LEFT JOIN landlord_profiles lp ON lp.user_id = l.landlord_id
     WHERE ${where}
     ORDER BY ${orderBy(q)}
     LIMIT ${q.limit} OFFSET ${offset}`;
  return { rows, total: rows[0] ? Number(rows[0].total) : 0 };
}

export interface MapPinRow {
  id: string;
  slug: string;
  title: string;
  rent_npr: number;
  bedrooms: number;
  property_type: string;
  lat: number;
  lng: number;
  location_is_approximate: boolean;
  cover_media_key: string | null;
}

/** Lightweight pins for the map viewport (max 500 — clustering handles density). */
export async function mapPins(q: SearchQuery): Promise<MapPinRow[]> {
  const where = Prisma.join([...whereClauses(q), Prisma.sql`l.location IS NOT NULL`], " AND ");
  return prisma.$queryRaw<MapPinRow[]>`
    SELECT l.id::text, l.slug, l.title, l.rent_npr, l.bedrooms, l.property_type::text,
           ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng, l.location_is_approximate,
           (SELECT p.media_key FROM listing_photos p WHERE p.listing_id = l.id AND p.status = 'ready'
             ORDER BY p.is_cover DESC, p.sort_order LIMIT 1) AS cover_media_key
      FROM listings l
      JOIN cities c ON c.id = l.city_id
      LEFT JOIN neighborhoods n ON n.id = l.neighborhood_id
     WHERE ${where}
     ORDER BY l.published_at DESC
     LIMIT 500`;
}

/** Similar = same city, similar price band, published, excluding self. */
export async function similarListingIds(
  listingId: string,
  cityId: number,
  rent: number,
  type: string,
  limit = 4,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id::text FROM listings
     WHERE status = 'published' AND id <> ${listingId}::uuid AND city_id = ${cityId}
       AND rent_npr BETWEEN ${Math.round(rent * 0.6)} AND ${Math.round(rent * 1.5)}
     ORDER BY (property_type::text = ${type}) DESC, ABS(rent_npr - ${rent}), published_at DESC
     LIMIT ${limit}`;
  return rows.map((r) => r.id);
}
