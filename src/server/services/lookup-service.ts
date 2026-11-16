import { unstable_cache } from "next/cache";
import { prisma } from "../lib/db";

/** Reference data changes rarely; cache for an hour and bust with revalidateTag("lookups"). */
export const getCities = unstable_cache(
  async () => {
    const rows = await prisma.$queryRaw<
      {
        id: number;
        name: string;
        name_ne: string | null;
        slug: string;
        province: string;
        district: string;
        lat: number | null;
        lng: number | null;
        listing_count: bigint;
      }[]
    >`
      SELECT c.id, c.name, c.name_ne, c.slug, c.province, c.district,
             ST_Y(c.centroid::geometry) AS lat, ST_X(c.centroid::geometry) AS lng,
             COUNT(l.id) FILTER (WHERE l.status = 'published') AS listing_count
        FROM cities c
        LEFT JOIN listings l ON l.city_id = c.id
       WHERE c.is_active
       GROUP BY c.id
       ORDER BY listing_count DESC, c.name`;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      nameNe: r.name_ne,
      slug: r.slug,
      province: r.province,
      district: r.district,
      lat: r.lat,
      lng: r.lng,
      listingCount: Number(r.listing_count),
    }));
  },
  ["cities"],
  { revalidate: 3600, tags: ["lookups"] },
);

export const getNeighborhoods = unstable_cache(
  async (cityId?: number) => {
    const rows = await prisma.$queryRaw<
      {
        id: number;
        city_id: number;
        name: string;
        name_ne: string | null;
        slug: string;
        lat: number | null;
        lng: number | null;
      }[]
    >`
      SELECT id, city_id, name, name_ne, slug, ST_Y(centroid::geometry) AS lat, ST_X(centroid::geometry) AS lng
        FROM neighborhoods
       WHERE (${cityId ?? null}::int IS NULL OR city_id = ${cityId ?? null}::int)
       ORDER BY name`;
    return rows.map((r) => ({
      id: r.id,
      cityId: r.city_id,
      name: r.name,
      nameNe: r.name_ne,
      slug: r.slug,
      lat: r.lat,
      lng: r.lng,
    }));
  },
  ["neighborhoods"],
  { revalidate: 3600, tags: ["lookups"] },
);

export const getAmenities = unstable_cache(
  async () => prisma.amenity.findMany({ orderBy: [{ category: "asc" }, { id: "asc" }] }),
  ["amenities"],
  { revalidate: 3600, tags: ["lookups"] },
);

export type CityOption = Awaited<ReturnType<typeof getCities>>[number];
export type NeighborhoodOption = Awaited<ReturnType<typeof getNeighborhoods>>[number];
export type AmenityOption = Awaited<ReturnType<typeof getAmenities>>[number];
