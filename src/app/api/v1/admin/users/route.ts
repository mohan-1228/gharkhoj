import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseQuery, route } from "@/server/lib/http";
import { listUsers } from "@/server/services/admin-service";

const q = z.object({ q: z.string().max(100).optional(), role: z.enum(["renter", "landlord", "admin"]).optional() });
export const GET = route(async (req) => {
  const { q: search, role } = parseQuery(req, q);
  return json({ items: await listUsers(await getCurrentUser(), search, role) });
});
