import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchView, type RawSearchParams } from "@/components/search/search-view";
import { SearchMapSlot } from "@/components/map/search-map-slot";
import { resolveRentPath } from "@/server/services/seo-service";

type Props = { params: Promise<{ city: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const r = await resolveRentPath(city);
  if (!r) return {};
  return {
    title: `Rooms, flats & houses for rent in ${r.city.name}`,
    description: `Find rentals in ${r.city.name}, ${r.city.district}: rooms, flats, apartments and houses with photos, maps and verified landlords. Prices in NPR.`,
    alternates: { canonical: `/rent/${r.city.slug}` },
  };
}

export default async function CityRentPage({ params, searchParams }: Props) {
  const { city } = await params;
  const r = await resolveRentPath(city);
  if (!r) notFound();
  return (
    <SearchView
      raw={await searchParams}
      fixed={{ city: r.city.slug }}
      basePath={`/rent/${r.city.slug}`}
      heading={`Rentals in ${r.city.name}`}
      intro={`${r.city.district} district, ${r.city.province} Province`}
      mapSlot={(q) => <SearchMapSlot query={q} />}
    />
  );
}
