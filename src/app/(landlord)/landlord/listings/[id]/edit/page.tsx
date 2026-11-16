import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/landlord/listing-form";
import { listingToFormValues } from "@/components/landlord/listing-form-values";
import { ListingStatusBadge } from "@/components/listings/status-badge";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { getListingForEdit } from "@/server/services/listing-service";
import { getListingFormLookups } from "@/server/services/lookups-for-form";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListingForEdit(await getCurrentUser(), id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  });
  const lookups = await getListingFormLookups();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Edit listing</h1>
        <ListingStatusBadge status={listing.status} />
      </div>
      {listing.status === "rejected" && listing.rejectionReason && (
        <p className="border-destructive/40 bg-destructive/5 mt-3 rounded-md border p-3 text-sm">
          <strong>Rejected by moderator:</strong> {listing.rejectionReason}. Fix the issue and submit again.
        </p>
      )}
      <div className="mt-6">
        <ListingForm
          mode="edit"
          listingId={listing.id}
          defaultValues={listingToFormValues(listing)}
          lookups={lookups}
        />
      </div>
    </div>
  );
}
