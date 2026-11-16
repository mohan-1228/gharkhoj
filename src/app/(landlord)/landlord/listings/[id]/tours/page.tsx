import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { getListingForEdit } from "@/server/services/listing-service";
import { getAvailability } from "@/server/services/tour-service";
import { AvailabilityEditor } from "@/components/tours/availability-editor";

export const metadata: Metadata = { title: "Tour availability", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListingForEdit(await getCurrentUser(), id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const availability = await getAvailability(id);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Tour availability</h1>
      <p className="text-muted-foreground text-sm">{listing.title}</p>
      <AvailabilityEditor listingId={id} initial={availability} />
    </div>
  );
}
