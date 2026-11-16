import { getCurrentUser } from "@/server/auth/session";
import { route } from "@/server/lib/http";
import { deleteSavedSearch } from "@/server/services/saved-search-service";

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await deleteSavedSearch(await getCurrentUser(), params.id);
  return new Response(null, { status: 204 });
});
