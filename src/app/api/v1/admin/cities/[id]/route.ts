import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { setCityActive } from "@/server/services/admin-service";

const body = z.object({ isActive: z.boolean() });
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { isActive } = await parseBody(req, body);
  return json(await setCityActive(await getCurrentUser(), z.coerce.number().int().parse(params.id), isActive));
});
