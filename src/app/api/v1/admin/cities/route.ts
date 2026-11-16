import { lookupCitySchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { createCity } from "@/server/services/admin-service";

export const POST = route(async (req) =>
  json(await createCity(await getCurrentUser(), await parseBody(req, lookupCitySchema)), 201),
);
