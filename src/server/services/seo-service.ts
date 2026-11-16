import { PROPERTY_TYPE_LABELS, PROPERTY_TYPE_SLUGS, type PropertyTypeValue } from "@/lib/constants";
import { prisma } from "../lib/db";

/** Resolve /rent/[city]/[segment] where segment is a neighbourhood slug or a property-type slug. */
export async function resolveRentPath(citySlug: string, segment?: string) {
  const city = await prisma.city.findFirst({ where: { slug: citySlug, isActive: true } });
  if (!city) return null;
  if (!segment) return { city, neighborhood: null, type: null as PropertyTypeValue | null };
  const type = PROPERTY_TYPE_SLUGS[segment];
  if (type) return { city, neighborhood: null, type };
  const neighborhood = await prisma.neighborhood.findUnique({
    where: { cityId_slug: { cityId: city.id, slug: segment } },
  });
  if (!neighborhood) return null;
  return { city, neighborhood, type: null as PropertyTypeValue | null };
}

export function typePlural(type: PropertyTypeValue): string {
  return (
    { room: "Rooms", studio_flat: "Flats", apartment: "Apartments", house: "Houses", office_space: "Office spaces" }[
      type
    ] ?? PROPERTY_TYPE_LABELS[type]
  );
}
