import type { Metadata } from "next";
import { ListingForm } from "@/components/landlord/listing-form";
import { emptyListingValues } from "@/components/landlord/listing-form-values";
import { getListingFormLookups } from "@/server/services/lookups-for-form";

export const metadata: Metadata = { title: "New listing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const lookups = await getListingFormLookups();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">List your property</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Save a draft first, then add photos and floor plans and submit for review.
      </p>
      <div className="mt-6">
        <ListingForm mode="create" defaultValues={emptyListingValues()} lookups={lookups} />
      </div>
    </div>
  );
}
