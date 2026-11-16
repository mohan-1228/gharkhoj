import { listingStatusActionSchema } from "@/schemas/listing";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import * as listings from "@/server/services/listing-service";

/** POST /api/v1/listings/:id/status — pause / resume / mark rented / archive / relist. */
export const POST = route<{ idOrSlug: string }>(async (req, { params }) => {
  const { action } = await parseBody(req, listingStatusActionSchema);
  const listing = await listings.changeStatus(await getCurrentUser(), params.idOrSlug, action);
  return json({ id: listing.id, status: listing.status });
});
