import { profileSchema } from "@/schemas/misc";
import { endSession, getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { deleteAccount, getMe, updateProfile } from "@/server/services/auth-service";

export const GET = route(async () => json(await getMe(await getCurrentUser())));

export const PATCH = route(async (req) => {
  const user = await updateProfile(await getCurrentUser(), await parseBody(req, profileSchema));
  return json({ id: user.id, fullName: user.fullName, phone: user.phone });
});

/** DELETE /api/v1/me — permanently delete my account and data. */
export const DELETE = route(async () => {
  await deleteAccount(await getCurrentUser());
  await endSession();
  return new Response(null, { status: 204 });
});
