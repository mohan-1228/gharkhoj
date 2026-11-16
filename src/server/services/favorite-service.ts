import { assertAuthenticated } from "../auth/guards";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { notFound } from "../lib/errors";
import { search } from "./search-service";

export async function addFavorite(actor: SessionUser | null, listingId: string) {
  assertAuthenticated(actor);
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "published" },
    select: { id: true },
  });
  if (!listing) throw notFound("Listing");
  await prisma.favorite.upsert({
    where: { userId_listingId: { userId: actor.id, listingId } },
    update: {},
    create: { userId: actor.id, listingId },
  });
}

export async function removeFavorite(actor: SessionUser | null, listingId: string) {
  assertAuthenticated(actor);
  await prisma.favorite.deleteMany({ where: { userId: actor.id, listingId } });
}

export async function favoriteIds(actor: SessionUser | null): Promise<Set<string>> {
  if (!actor) return new Set();
  const rows = await prisma.favorite.findMany({ where: { userId: actor.id }, select: { listingId: true } });
  return new Set(rows.map((r) => r.listingId));
}

/** Favorites as search cards, newest-saved first (only still-published listings are shown). */
export async function listFavorites(actor: SessionUser | null) {
  assertAuthenticated(actor);
  const favs = await prisma.favorite.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    select: { listingId: true },
    take: 100,
  });
  if (!favs.length) return [];
  const res = await search({ ids: favs.map((f) => f.listingId), sort: "newest", page: 1, limit: 50 });
  const map = new Map(res.items.map((i) => [i.id, i]));
  return favs.map((f) => map.get(f.listingId)).filter((x): x is NonNullable<typeof x> => Boolean(x));
}
