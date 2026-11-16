import { createListingSchema } from "@/schemas/listing";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, parseQuery, route } from "@/server/lib/http";
import { searchQuerySchema } from "@/schemas/search";
import { search } from "@/server/services/search-service";
import * as listings from "@/server/services/listing-service";

/** POST /api/v1/listings — landlord creates a draft. */
export const POST = route(async (req) => {
  const input = await parseBody(req, createListingSchema);
  const listing = await listings.createDraft(await getCurrentUser(), input);
  return json({ id: listing.id, slug: listing.slug, status: listing.status }, 201);
});

/** GET /api/v1/listings — public search with filters, sort, pagination, bbox and radius. */
export const GET = route(async (req) => {
  const q = parseQuery(req, searchQuerySchema);
  return json(await search(q), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
});
