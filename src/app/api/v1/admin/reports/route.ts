import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseQuery, route } from "@/server/lib/http";
import { listReports } from "@/server/services/admin-service";

const q = z.object({ status: z.enum(["open", "resolved", "dismissed"]).default("open") });
export const GET = route(async (req) =>
  json({ items: await listReports(await getCurrentUser(), parseQuery(req, q).status) }),
);
