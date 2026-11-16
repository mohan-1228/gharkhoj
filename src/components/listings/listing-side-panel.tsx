import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TourRequestPanel } from "@/components/tours/tour-request-panel";
import { MobileTourBar } from "@/components/tours/mobile-tour-bar";
import { formatNpr } from "@/lib/format";

/** Sticky "Schedule a tour" panel (desktop) + bottom CTA bar (mobile). */
export function ListingSidePanel({
  listing,
}: {
  listing: { id: string; slug: string; title: string; rentNpr: number; status: string; isOwner: boolean };
}) {
  const header = (
    <p className="text-2xl font-bold">
      {formatNpr(listing.rentNpr)} <span className="text-muted-foreground text-sm font-normal">/ month</span>
    </p>
  );
  if (listing.isOwner) {
    return (
      <div className="rounded-xl border p-4 shadow-sm">
        {header}
        <Button asChild className="mt-4 w-full">
          <Link href={`/landlord/listings/${listing.id}/edit`}>Edit your listing</Link>
        </Button>
      </div>
    );
  }
  if (listing.status !== "published") return null;
  return (
    <>
      <div id="schedule-tour" className="hidden scroll-mt-20 rounded-xl border p-4 shadow-sm lg:block">
        {header}
        <h2 className="mt-3 mb-3 text-lg font-semibold">Schedule a tour</h2>
        <TourRequestPanel listingId={listing.id} />
      </div>
      <MobileTourBar listingId={listing.id} rentNpr={listing.rentNpr} />
    </>
  );
}
