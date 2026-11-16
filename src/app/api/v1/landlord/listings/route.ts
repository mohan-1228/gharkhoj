import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import * as listings from "@/server/services/listing-service";

/** GET /api/v1/landlord/listings — the signed-in landlord's listings. */
export const GET = route(async () => {
  const items = await listings.listLandlordListings(await getCurrentUser());
  return json({ items });
});
