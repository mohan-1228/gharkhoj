import { z } from "zod";
import { TOUR_STATUSES } from "@/lib/constants";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseQuery, route } from "@/server/lib/http";
import { listLandlordTours } from "@/server/services/tour-service";

const query = z.object({ status: z.enum(TOUR_STATUSES).optional() });

export const GET = route(async (req) => {
  const { status } = parseQuery(req, query);
  return json({ items: await listLandlordTours(await getCurrentUser(), status) });
});
