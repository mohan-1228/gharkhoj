import { presignSchema } from "@/schemas/misc";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import { createPresignedUpload } from "@/server/services/media-service";

/** POST /api/v1/uploads/presign — returns a presigned S3 POST (type + size enforced by policy). */
export const POST = route(async (req) => {
  const input = await parseBody(req, presignSchema);
  return json(await createPresignedUpload(await getCurrentUser(), input), 201);
});
