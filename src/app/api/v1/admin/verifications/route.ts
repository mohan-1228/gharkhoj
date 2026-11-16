import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { pendingVerifications } from "@/server/services/admin-service";

export const GET = route(async () => json({ items: await pendingVerifications(await getCurrentUser()) }));
