import { updateTourSchema } from "@/schemas/tour";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { updateTour } from "@/server/services/tour-service";

/** PATCH /api/v1/tours/:id — landlord confirm/decline/reschedule/complete/no_show; renter cancel/accept. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const input = await parseBody(req, updateTourSchema);
  return json(await updateTour(await getCurrentUser(), params.id, input));
});
