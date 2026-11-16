import { getCurrentUser } from "@/server/auth/session";
import { route } from "@/server/lib/http";
import { deletePhoto } from "@/server/services/media-service";

export const DELETE = route<{ idOrSlug: string; photoId: string }>(async (_req, { params }) => {
  await deletePhoto(await getCurrentUser(), params.idOrSlug, params.photoId);
  return new Response(null, { status: 204 });
});
