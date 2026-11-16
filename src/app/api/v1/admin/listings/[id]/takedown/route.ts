import { rejectSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { takeDownListing } from "@/server/services/admin-service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { reason } = await parseBody(req, rejectSchema);
  await takeDownListing(await getCurrentUser(), params.id, reason);
  return json({ ok: true });
});
