import { lookupNeighborhoodSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { createNeighborhood } from "@/server/services/admin-service";

export const POST = route(async (req) =>
  json(await createNeighborhood(await getCurrentUser(), await parseBody(req, lookupNeighborhoodSchema)), 201),
);
