import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchView, type RawSearchParams } from "@/components/search/search-view";
import { SearchMapSlot } from "@/components/map/search-map-slot";
import { resolveRentPath, typePlural } from "@/server/services/seo-service";

type Props = { params: Promise<{ city: string; segment: string }>; searchParams: Promise<RawSearchParams> };

async function resolve(props: Props) {
  const { city, segment } = await props.params;
  const r = await resolveRentPath(city, segment);
  if (!r) return null;
  const place = r.neighborhood ? `${r.neighborhood.name}, ${r.city.name}` : r.city.name;
  const what = r.type ? typePlural(r.type) : "Rentals";
  return { r, place, what, path: `/rent/${r.city.slug}/${segment}` };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const x = await resolve(props);
  if (!x) return {};
  return {
    title: `${x.what} for rent in ${x.place}`,
    description: `Browse ${x.what.toLowerCase()} for rent in ${x.place}. Compare monthly rent in NPR, photos, amenities and location on the map.`,
    alternates: { canonical: x.path },
  };
}

export default async function SegmentRentPage(props: Props) {
  const x = await resolve(props);
  if (!x) notFound();
  return (
    <SearchView
      raw={await props.searchParams}
      fixed={{
        city: x.r.city.slug,
        ...(x.r.neighborhood ? { neighborhood: x.r.neighborhood.slug } : {}),
        ...(x.r.type ? { type: [x.r.type] } : {}),
      }}
      basePath={x.path}
      heading={`${x.what} for rent in ${x.place}`}
      mapSlot={(q) => <SearchMapSlot query={q} />}
    />
  );
}
