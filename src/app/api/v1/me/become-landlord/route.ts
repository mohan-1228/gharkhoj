import { getCurrentUser, startSession } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { becomeLandlord } from "@/server/services/auth-service";

export const POST = route(async () => {
  const user = await becomeLandlord(await getCurrentUser());
  await startSession(user); // refresh role hint in the cookie
  return json({ role: user.role });
});
