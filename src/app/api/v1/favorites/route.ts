import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { listFavorites } from "@/server/services/favorite-service";

export const GET = route(async () => json({ items: await listFavorites(await getCurrentUser()) }));
