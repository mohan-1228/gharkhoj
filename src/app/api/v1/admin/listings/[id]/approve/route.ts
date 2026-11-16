import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { approveListing } from "@/server/services/admin-service";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const l = await approveListing(await getCurrentUser(), params.id);
  return json({ id: l.id, status: l.status });
});
