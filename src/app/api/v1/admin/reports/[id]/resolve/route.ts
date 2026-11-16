import { resolveReportSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { resolveReport } from "@/server/services/admin-service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  await resolveReport(await getCurrentUser(), params.id, await parseBody(req, resolveReportSchema));
  return json({ ok: true });
});
