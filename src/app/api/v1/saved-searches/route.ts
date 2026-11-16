import { savedSearchSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { createSavedSearch, listSavedSearches } from "@/server/services/saved-search-service";

export const GET = route(async () => json({ items: await listSavedSearches(await getCurrentUser()) }));
export const POST = route(async (req) =>
  json(await createSavedSearch(await getCurrentUser(), await parseBody(req, savedSearchSchema)), 201),
);
