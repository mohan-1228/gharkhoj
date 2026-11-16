import { json, route } from "@/server/lib/http";
import { getBookableSlots } from "@/server/services/tour-service";

/** GET /api/v1/listings/:id/slots — bookable tour times for the next 14 days. */
export const GET = route<{ idOrSlug: string }>(async (_req, { params }) => {
  return json(
    { days: await getBookableSlots(params.idOrSlug) },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
});
