import { registerPhotoSchema, updatePhotosSchema } from "@/schemas/listing";
import { getCurrentUser } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/lib/http";
import * as media from "@/server/services/media-service";

type Params = { idOrSlug: string };

/** POST /api/v1/listings/:id/photos — register an uploaded photo (processed + moderated). */
export const POST = route<Params>(async (req, { params }) => {
  const input = await parseBody(req, registerPhotoSchema);
  return json(await media.registerPhoto(await getCurrentUser(), params.idOrSlug, input), 201);
});

/** PATCH /api/v1/listings/:id/photos — reorder, captions, cover. */
export const PATCH = route<Params>(async (req, { params }) => {
  const input = await parseBody(req, updatePhotosSchema);
  return json({ items: await media.updatePhotos(await getCurrentUser(), params.idOrSlug, input) });
});
