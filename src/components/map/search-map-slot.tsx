import type { SearchQuery } from "@/schemas/search";
import { getCities } from "@/server/services/lookup-service";
import { SearchMapLoader } from "./search-map-loader";

/** Server wrapper: serialises the validated query for the client map. */
export async function SearchMapSlot({ query }: { query: SearchQuery }) {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || k === "page" || k === "limit" || k === "sort") continue;
    params[k] = v instanceof Date ? v.toISOString().slice(0, 10) : Array.isArray(v) ? v.join(",") : String(v);
  }
  const city = query.city ? (await getCities()).find((c) => c.slug === query.city) : undefined;
  return <SearchMapLoader params={params} initialCenter={city?.lat && city.lng ? [city.lat, city.lng] : undefined} />;
}
