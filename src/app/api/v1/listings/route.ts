import { createListingSchema } from "@/schemas/listing";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import * as listings from "@/server/services/listing-service";

/** POST /api/v1/listings — landlord creates a draft. */
export const POST = route(async (req) => {
  const input = await parseBody(req, createListingSchema);
  const listing = await listings.createDraft(await getCurrentUser(), input);
  return json({ id: listing.id, slug: listing.slug, status: listing.status }, 201);
});
