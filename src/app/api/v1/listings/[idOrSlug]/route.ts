import { updateListingSchema } from "@/schemas/listing";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import * as listings from "@/server/services/listing-service";

type Params = { idOrSlug: string };

/** PATCH /api/v1/listings/:id — owner updates. */
export const PATCH = route<Params>(async (req, { params }) => {
  const input = await parseBody(req, updateListingSchema);
  const listing = await listings.updateListing(await getCurrentUser(), params.idOrSlug, input);
  return json({ id: listing.id, slug: listing.slug, status: listing.status });
});

/** DELETE /api/v1/listings/:id — owner or admin. */
export const DELETE = route<Params>(async (_req, { params }) => {
  await listings.deleteListing(await getCurrentUser(), params.idOrSlug);
  return new Response(null, { status: 204 });
});
