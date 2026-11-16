import { getAmenities, getCities, getNeighborhoods } from "./lookup-service";

/** Lookup payload for the listing form (cities, neighbourhoods, amenities). */
export async function getListingFormLookups() {
  const [cities, neighborhoods, amenities] = await Promise.all([getCities(), getNeighborhoods(), getAmenities()]);
  return {
    cities: [...cities]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng })),
    neighborhoods: neighborhoods.map((n) => ({ id: n.id, cityId: n.cityId, name: n.name, lat: n.lat, lng: n.lng })),
    amenities: amenities.map((a) => ({ code: a.code, label: a.label, category: a.category })),
  };
}
