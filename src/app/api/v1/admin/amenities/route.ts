import { lookupAmenitySchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { createAmenity } from "@/server/services/admin-service";

export const POST = route(async (req) =>
  json(await createAmenity(await getCurrentUser(), await parseBody(req, lookupAmenitySchema)), 201),
);
