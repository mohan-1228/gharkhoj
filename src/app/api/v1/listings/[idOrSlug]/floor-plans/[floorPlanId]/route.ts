import { getCurrentUser } from "@/server/auth/session";
import { route } from "@/server/lib/http";
import { deleteFloorPlan } from "@/server/services/media-service";

export const DELETE = route<{ idOrSlug: string; floorPlanId: string }>(async (_req, { params }) => {
  await deleteFloorPlan(await getCurrentUser(), params.idOrSlug, params.floorPlanId);
  return new Response(null, { status: 204 });
});
