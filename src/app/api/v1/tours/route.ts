import { createTourSchema } from "@/schemas/tour";
import { assertAuthenticated } from "@/server/auth/guards";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { clientIp, rateLimit } from "@/server/lib/rate-limit";
import { requestTour, toTourDto } from "@/server/services/tour-service";

/** POST /api/v1/tours — renter requests a tour. Send an `Idempotency-Key` header to make retries safe. */
export const POST = route(async (req) => {
  rateLimit(`tour:${clientIp(req.headers)}`, 10, 60 * 60_000);
  const actor = await getCurrentUser();
  assertAuthenticated(actor);
  const input = await parseBody(req, createTourSchema);
  const key = req.headers.get("idempotency-key")?.slice(0, 100) || undefined;
  const { tour, created } = await requestTour(actor, input, key);
  return json(toTourDto(tour, actor), created ? 201 : 200);
});
