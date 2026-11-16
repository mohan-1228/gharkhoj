import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { favoriteIds } from "@/server/services/favorite-service";

/** GET /api/v1/favorites/ids — ids only, for heart state on cards (empty when signed out). */
export const GET = route(async () => {
  const ids = await favoriteIds(await getCurrentUser());
  return json({ ids: [...ids] }, { headers: { "Cache-Control": "private, no-store" } });
});
