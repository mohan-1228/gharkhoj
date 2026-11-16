import { createReportSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { clientIp, rateLimit } from "@/server/lib/rate-limit";
import { createReport } from "@/server/services/admin-service";

/** POST /api/v1/reports — anyone can report a listing (rate limited). */
export const POST = route(async (req) => {
  rateLimit(`report:${clientIp(req.headers)}`, 5, 60 * 60_000);
  const r = await createReport(await getCurrentUser(), await parseBody(req, createReportSchema));
  return json({ id: r.id }, 201);
});
