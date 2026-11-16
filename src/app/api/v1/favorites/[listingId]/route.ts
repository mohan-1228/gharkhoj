import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { addFavorite, removeFavorite } from "@/server/services/favorite-service";

type Params = { listingId: string };
const id = z.string().uuid();

export const POST = route<Params>(async (_req, { params }) => {
  await addFavorite(await getCurrentUser(), id.parse(params.listingId));
  return json({ favorited: true }, 201);
});

export const DELETE = route<Params>(async (_req, { params }) => {
  await removeFavorite(await getCurrentUser(), id.parse(params.listingId));
  return json({ favorited: false });
});
