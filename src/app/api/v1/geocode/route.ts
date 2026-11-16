import { z } from "zod";
import { json, parseQuery, route } from "@/server/lib/http";
import { clientIp, rateLimit } from "@/server/lib/rate-limit";
import { geocode } from "@/server/services/geocode-service";

const query = z.object({
  q: z.string().trim().min(3).max(120),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

/** GET /api/v1/geocode?q=… — Nepal-only address/landmark lookup (cached, throttled proxy to Nominatim). */
export const GET = route(async (req) => {
  rateLimit(`geocode:${clientIp(req.headers)}`, 20, 60_000);
  const { q, lat, lng } = parseQuery(req, query);
  const items = await geocode(q, lat != null && lng != null ? { lat, lng } : undefined);
  return json({ items }, { headers: { "Cache-Control": "private, max-age=3600" } });
});
