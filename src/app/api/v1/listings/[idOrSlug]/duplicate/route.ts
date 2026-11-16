import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import * as listings from "@/server/services/listing-service";

/** POST /api/v1/listings/:id/duplicate — copy into a new draft. */
export const POST = route<{ idOrSlug: string }>(async (_req, { params }) => {
  const listing = await listings.duplicateListing(await getCurrentUser(), params.idOrSlug);
  return json({ id: listing.id, slug: listing.slug, status: listing.status }, 201);
});
