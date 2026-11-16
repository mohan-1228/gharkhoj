import { verifyLandlordSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { decideVerification } from "@/server/services/admin-service";

export const POST = route<{ userId: string }>(async (req, { params }) => {
  await decideVerification(await getCurrentUser(), params.userId, await parseBody(req, verifyLandlordSchema));
  return json({ ok: true });
});
