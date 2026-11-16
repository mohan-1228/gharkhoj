import { z } from "zod";
import { startSession } from "@/server/auth/session";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { json, parseBody, route } from "@/server/lib/http";
import { devLogin } from "@/server/services/auth-service";

const schema = z.object({
  email: z.string().email().max(200),
  fullName: z.string().max(100).optional(),
  role: z.enum(["renter", "landlord"]).optional(),
});

/** POST /api/v1/auth/dev-login — LOCAL DEVELOPMENT ONLY (AUTH_MODE=dev). */
export const POST = route(async (req) => {
  if (env.AUTH_MODE !== "dev") throw new AppError("NOT_FOUND", "Not found");
  const user = await devLogin(await parseBody(req, schema));
  await startSession(user);
  return json({ id: user.id, role: user.role });
});
