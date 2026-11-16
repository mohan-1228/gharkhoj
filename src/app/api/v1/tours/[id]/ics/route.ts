import { getCurrentUser } from "@/server/auth/session";
import { route } from "@/server/lib/http";
import { tourIcs } from "@/server/services/tour-service";

/** GET /api/v1/tours/:id/ics — add-to-calendar file for a confirmed tour. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const ics = await tourIcs(await getCurrentUser(), params.id);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="gharkhoj-tour.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
});
