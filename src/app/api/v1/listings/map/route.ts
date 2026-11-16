import { searchQuerySchema } from "@/schemas/search";
import { json, parseQuery, route } from "@/server/lib/http";
import { searchMap } from "@/server/services/search-service";

/** GET /api/v1/listings/map — lightweight pins for the current viewport (same filters as search). */
export const GET = route(async (req) => {
  const q = parseQuery(req, searchQuerySchema);
  return json({ items: await searchMap(q) }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
});
