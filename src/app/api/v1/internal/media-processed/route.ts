import { z } from "zod";
import { assertInternalRequest } from "@/server/auth/internal";
import { json, parseBody, route } from "@/server/lib/http";
import { markMediaProcessed } from "@/server/services/media-service";

const schema = z.object({
  s3Key: z.string().startsWith("uploads/"),
  status: z.enum(["ready", "rejected"]),
  mediaKey: z.string().startsWith("media/").optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  labels: z.array(z.string()).optional(),
});

/** POST /api/v1/internal/media-processed — callback from the image-processor Lambda. */
export const POST = route(async (req) => {
  assertInternalRequest(req);
  const input = await parseBody(req, schema);
  await markMediaProcessed(input);
  return json({ ok: true });
});
