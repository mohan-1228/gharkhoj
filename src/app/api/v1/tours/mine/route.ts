import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { listMyTours } from "@/server/services/tour-service";

export const GET = route(async () => json({ items: await listMyTours(await getCurrentUser()) }));
