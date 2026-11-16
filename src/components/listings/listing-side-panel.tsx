import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatNpr } from "@/lib/format";

/** Sticky contact panel. Tour scheduling is wired up in phase 6. */
export function ListingSidePanel({
  listing,
}: {
  listing: { id: string; slug: string; title: string; rentNpr: number; status: string; isOwner: boolean };
}) {
  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <p className="text-2xl font-bold">
        {formatNpr(listing.rentNpr)} <span className="text-muted-foreground text-sm font-normal">/ month</span>
      </p>
      {listing.isOwner ? (
        <Button asChild className="mt-4 w-full">
          <Link href={`/landlord/listings/${listing.id}/edit`}>Edit your listing</Link>
        </Button>
      ) : (
        <Button className="mt-4 w-full" disabled>
          Schedule a tour
        </Button>
      )}
    </div>
  );
}
