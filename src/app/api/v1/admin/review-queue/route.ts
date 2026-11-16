import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { reviewQueue } from "@/server/services/admin-service";

export const GET = route(async () => json({ items: await reviewQueue(await getCurrentUser()) }));
