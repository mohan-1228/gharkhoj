import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { auditLog } from "@/server/services/admin-service";

export const GET = route(async () => json({ items: await auditLog(await getCurrentUser()) }));
