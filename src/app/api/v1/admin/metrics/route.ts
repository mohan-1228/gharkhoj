import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { adminMetrics } from "@/server/services/admin-service";

export const GET = route(async () => json(await adminMetrics(await getCurrentUser())));
