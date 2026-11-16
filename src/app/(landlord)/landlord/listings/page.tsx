import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingStatusBadge } from "@/components/listings/status-badge";
import { ListingActions } from "@/components/landlord/listing-actions";
import { getCurrentUser } from "@/server/auth/session";
import { listLandlordListings } from "@/server/services/listing-service";
import { formatRent } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "My listings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LandlordListingsPage() {
  const listings = await listLandlordListings(await getCurrentUser());
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My listings</h1>
          <p className="text-muted-foreground text-sm">{listings.length} total</p>
        </div>
        <Button asChild>
          <Link href="/landlord/listings/new">
            <Plus className="size-4" /> New listing
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">You haven&apos;t listed anything yet.</p>
          <p className="text-muted-foreground mt-1 text-sm">Create your first listing — it takes about five minutes.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/landlord/listings/${l.id}/edit`} className="truncate font-medium hover:underline">
                    {l.title}
                  </Link>
                  <ListingStatusBadge status={l.status} />
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {PROPERTY_TYPE_LABELS[l.propertyType]} · {l.neighborhood?.name ? `${l.neighborhood.name}, ` : ""}
                  {l.city.name} · {formatRent(l.rentNpr)}
                </p>
                {l.status === "rejected" && l.rejectionReason && (
                  <p className="text-destructive mt-1 text-sm">Rejected: {l.rejectionReason}</p>
                )}
              </div>
              <dl className="text-muted-foreground flex gap-4 text-center text-xs">
                <div>
                  <dt>Views</dt>
                  <dd className="text-foreground text-base font-semibold">{l.viewCount}</dd>
                </div>
                <div>
                  <dt>Saves</dt>
                  <dd className="text-foreground text-base font-semibold">{l._count.favorites}</dd>
                </div>
                <div>
                  <dt>Tour requests</dt>
                  <dd className="text-foreground text-base font-semibold">{l._count.tourRequests}</dd>
                </div>
              </dl>
              <ListingActions id={l.id} slug={l.slug} status={l.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
