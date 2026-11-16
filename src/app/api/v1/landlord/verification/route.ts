import { verificationRequestSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { requestVerification } from "@/server/services/admin-service";

/** POST /api/v1/landlord/verification — submit an uploaded citizenship/ownership document for review. */
export const POST = route(async (req) => {
  const { key } = await parseBody(req, verificationRequestSchema);
  await requestVerification(await getCurrentUser(), key);
  return json({ status: "pending" });
});
