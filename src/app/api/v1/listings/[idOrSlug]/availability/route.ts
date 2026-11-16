import { availabilitySchema } from "@/schemas/tour";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { getAvailability, setAvailability } from "@/server/services/tour-service";

type Params = { idOrSlug: string };

export const GET = route<Params>(async (_req, { params }) => json(await getAvailability(params.idOrSlug)));

/** PUT /api/v1/listings/:id/availability — replace weekly windows + exception dates. */
export const PUT = route<Params>(async (req, { params }) => {
  return json(await setAvailability(await getCurrentUser(), params.idOrSlug, await parseBody(req, availabilitySchema)));
});
