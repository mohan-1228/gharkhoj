import { logoutUrl } from "@/server/auth/cognito";
import { endSession } from "@/server/auth/session";
import { env } from "@/server/lib/env";
import { json, route } from "@/server/lib/http";

/** POST /api/v1/auth/logout — clears our session; in Cognito mode also returns the Hosted UI logout URL. */
export const POST = route(async () => {
  await endSession();
  return json({ redirect: env.AUTH_MODE === "cognito" ? logoutUrl() : "/" });
});
