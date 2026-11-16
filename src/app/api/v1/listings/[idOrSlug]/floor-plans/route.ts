import { registerFloorPlanSchema } from "@/schemas/listing";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { registerFloorPlan } from "@/server/services/media-service";

/** POST /api/v1/listings/:id/floor-plans — register an uploaded floor plan (image or PDF). */
export const POST = route<{ idOrSlug: string }>(async (req, { params }) => {
  const input = await parseBody(req, registerFloorPlanSchema);
  return json(await registerFloorPlan(await getCurrentUser(), params.idOrSlug, input), 201);
});
