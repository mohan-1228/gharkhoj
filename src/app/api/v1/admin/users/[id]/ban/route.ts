import { banUserSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { setBanned } from "@/server/services/admin-service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { banned } = await parseBody(req, banUserSchema);
  await setBanned(await getCurrentUser(), params.id, banned);
  return json({ ok: true });
});
