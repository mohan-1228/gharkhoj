import type { Metadata } from "next";
import { SearchView, type RawSearchParams } from "@/components/search/search-view";
import { SearchMapSlot } from "@/components/map/search-map-slot";

export const metadata: Metadata = {
  title: "Rentals across Nepal",
  description:
    "Search rooms, flats, apartments and houses for rent across Nepal. Filter by price, bedrooms, amenities and tenant type.",
  alternates: { canonical: "/rent" },
};

export default async function RentPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  return (
    <SearchView
      raw={raw}
      basePath="/rent"
      heading="Rentals across Nepal"
      mapSlot={(q) => <SearchMapSlot query={q} />}
    />
  );
}
