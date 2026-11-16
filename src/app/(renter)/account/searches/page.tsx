import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { listSavedSearches, savedSearchHref } from "@/server/services/saved-search-service";
import { AccountNav } from "@/components/account/account-nav";
import { DeleteSavedSearch } from "@/components/account/delete-saved-search";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const items = await listSavedSearches(await getCurrentUser());
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Saved searches</h1>
      <AccountNav current="/account/searches" />
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-8">Use “Save search” on any results page to come back to it later.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link
                  href={savedSearchHref(s.filters as Record<string, unknown>)}
                  className="font-medium hover:underline"
                >
                  {s.name}
                </Link>
                <p className="text-muted-foreground text-xs">
                  Email alerts: {s.alertFrequency === "none" ? "off" : s.alertFrequency}
                </p>
              </div>
              <DeleteSavedSearch id={s.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
