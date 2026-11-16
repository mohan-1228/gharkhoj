import { setRoleSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { changeRole } from "@/server/services/admin-service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { role } = await parseBody(req, setRoleSchema);
  await changeRole(await getCurrentUser(), params.id, role);
  return json({ ok: true });
});
