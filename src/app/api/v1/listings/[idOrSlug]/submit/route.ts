import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import * as listings from "@/server/services/listing-service";

/** POST /api/v1/listings/:id/submit — send for moderation. */
export const POST = route<{ idOrSlug: string }>(async (_req, { params }) => {
  const listing = await listings.submitForReview(await getCurrentUser(), params.idOrSlug);
  return json({ id: listing.id, status: listing.status });
});
