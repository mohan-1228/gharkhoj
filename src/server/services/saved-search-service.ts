import type { Prisma } from "@prisma/client";
import { assertAuthenticated } from "../auth/guards";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { AppError, notFound } from "../lib/errors";

const MAX_SAVED = 20;

export async function createSavedSearch(
  actor: SessionUser | null,
  input: { name: string; filters: Record<string, unknown>; alertFrequency: "none" | "daily" | "weekly" },
) {
  assertAuthenticated(actor);
  if ((await prisma.savedSearch.count({ where: { userId: actor.id } })) >= MAX_SAVED) {
    throw new AppError("INVALID_STATE", `You can save up to ${MAX_SAVED} searches`);
  }
  return prisma.savedSearch.create({
    data: {
      userId: actor.id,
      name: input.name,
      filters: input.filters as Prisma.InputJsonValue,
      alertFrequency: input.alertFrequency,
    },
  });
}

export async function listSavedSearches(actor: SessionUser | null) {
  assertAuthenticated(actor);
  return prisma.savedSearch.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" } });
}

export async function deleteSavedSearch(actor: SessionUser | null, id: string) {
  assertAuthenticated(actor);
  const r = await prisma.savedSearch.deleteMany({ where: { id, userId: actor.id } });
  if (r.count === 0) throw notFound("Saved search");
}

/** Rebuild a /rent URL from stored filters. */
export function savedSearchHref(filters: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  const base =
    filters.city && filters.segment
      ? `/rent/${filters.city}/${filters.segment}`
      : filters.city
        ? `/rent/${filters.city}`
        : "/rent";
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === "" || ["page", "city", "segment"].includes(k)) continue;
    sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  return `${base}${sp.size ? `?${sp}` : ""}`;
}
