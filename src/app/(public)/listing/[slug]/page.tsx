import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BadgeCheck, Bath, BedDouble, CalendarDays, Layers, MapPin, Ruler, Sofa } from "lucide-react";
import { Gallery } from "@/components/listings/gallery";
import { FloorPlans } from "@/components/listings/floor-plans";
import { ShareButtons } from "@/components/listings/share-buttons";
import { AmenityIcon } from "@/components/listings/amenity-icon";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingStatusBadge } from "@/components/listings/status-badge";
import { ListingSidePanel } from "@/components/listings/listing-side-panel";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { RecordView } from "@/components/listings/recently-viewed";
import { ReportButton } from "@/components/listings/report-button";
import { ListingMiniMap } from "@/components/map/listing-mini-map";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { getPublicListing, getSimilarListings } from "@/server/services/listing-detail-service";
import {
  ELECTRICITY_BACKUP_LABELS,
  FURNISHING_LABELS,
  GAS_SUPPLY_LABELS,
  PROPERTY_TYPE_LABELS,
  TENANT_TYPE_LABELS,
  WATER_SUPPLY_LABELS,
} from "@/lib/constants";
import { formatDateOnly, formatNpr, formatSqft, sqftToRopani } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => {
  try {
    return await getPublicListing(slug, await getCurrentUser());
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await load((await params).slug);
  if (!l) return { title: "Listing not found" };
  const place = [l.neighborhood?.name, l.city.name].filter(Boolean).join(", ");
  const description = `${formatNpr(l.rentNpr)}/month · ${PROPERTY_TYPE_LABELS[l.propertyType]} in ${place}. ${l.description.slice(0, 140)}`;
  return {
    title: `${l.title} — ${formatNpr(l.rentNpr)}/month`,
    description,
    alternates: { canonical: `/listing/${l.slug}` },
    robots: l.status === "published" ? undefined : { index: false },
    openGraph: {
      title: l.title,
      description,
      type: "website",
      images: l.photos[0]?.urls ? [{ url: l.photos[0].urls.lg, width: 1280 }] : [],
    },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const l = await load(slug);
  if (!l) notFound();
  const similar = l.status === "published" ? await getSimilarListings(l) : [];
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/listing/${l.slug}`;
  const place = [l.neighborhood?.name, l.city.name].filter(Boolean).join(", ");
  const byCategory: Partial<Record<string, typeof l.amenities>> = {};
  for (const a of l.amenities) (byCategory[a.category] ??= []).push(a);

  // Schema.org structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: l.title,
    description: l.description,
    url,
    image: l.photos.flatMap((p) => (p.urls ? [p.urls.lg] : [])).slice(0, 5),
    numberOfRooms: l.bedrooms,
    numberOfBathroomsTotal: l.bathrooms,
    floorSize: l.areaSqft ? { "@type": "QuantitativeValue", value: l.areaSqft, unitCode: "FTK" } : undefined,
    petsAllowed: l.petsAllowed,
    amenityFeature: l.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a.label, value: true })),
    address: {
      "@type": "PostalAddress",
      addressLocality: l.city.name,
      addressRegion: `${l.city.province} Province`,
      addressCountry: "NP",
    },
    ...(l.location ? { geo: { "@type": "GeoCoordinates", latitude: l.location.lat, longitude: l.location.lng } } : {}),
    offers: {
      "@type": "Offer",
      price: l.rentNpr,
      priceCurrency: "NPR",
      availability: "https://schema.org/InStock",
      availabilityStarts: l.availableFrom,
    },
  };

  const facts = [
    { icon: BedDouble, label: "Bedrooms", value: l.bedrooms === 0 ? "Studio" : l.bedrooms },
    { icon: Bath, label: "Bathrooms", value: l.bathrooms },
    ...(l.areaSqft ? [{ icon: Ruler, label: "Area", value: formatSqft(l.areaSqft) }] : []),
    { icon: Sofa, label: "Furnishing", value: FURNISHING_LABELS[l.furnishing] },
    ...(l.floorNo != null
      ? [
          {
            icon: Layers,
            label: "Floor",
            value: l.totalFloors ? `${l.floorNo === 0 ? "Ground" : l.floorNo} of ${l.totalFloors}` : l.floorNo,
          },
        ]
      : []),
    { icon: CalendarDays, label: "Available", value: formatDateOnly(l.availableFrom) },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* JSON.stringify output is safe: no user HTML is interpreted; "<" is escaped to prevent </script> breakout. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {l.status === "published" && (
        <RecordView
          item={{ slug: l.slug, title: l.title, rentNpr: l.rentNpr, image: l.photos[0]?.urls?.sm ?? null, place }}
        />
      )}
      <nav aria-label="Breadcrumb" className="text-muted-foreground mb-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/rent" className="hover:underline">
              Rent
            </Link>{" "}
            /
          </li>
          <li>
            <Link href={`/rent/${l.city.slug}`} className="hover:underline">
              {l.city.name}
            </Link>
            {l.neighborhood && " /"}
          </li>
          {l.neighborhood && (
            <li>
              <Link href={`/rent/${l.city.slug}/${l.neighborhood.slug}`} className="hover:underline">
                {l.neighborhood.name}
              </Link>
            </li>
          )}
        </ol>
      </nav>

      {l.status !== "published" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Preview — this listing is <ListingStatusBadge status={l.status} /> and not visible to the public.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <Gallery photos={l.photos} title={l.title} />

          <header className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-primary text-sm font-medium">{PROPERTY_TYPE_LABELS[l.propertyType]}</p>
              {l.status === "published" && <FavoriteButton listingId={l.id} withLabel className="border" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{l.title}</h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <MapPin className="size-4" aria-hidden />
              {place}
              {l.wardNo ? ` · Ward ${l.wardNo}` : ""}
              {l.landmark ? ` · ${l.landmark}` : ""}
            </p>
            <p className="text-3xl font-bold">
              {formatNpr(l.rentNpr)} <span className="text-muted-foreground text-base font-normal">/ month</span>
            </p>
            <p className="text-muted-foreground text-sm">
              {l.depositNpr ? `Deposit ${formatNpr(l.depositNpr)}` : "No deposit listed"} · Minimum lease{" "}
              {l.minLeaseMonths} month{l.minLeaseMonths > 1 ? "s" : ""}
              {l.negotiable && " · Negotiable"}
            </p>
          </header>

          <section aria-label="Key facts">
            <dl className="grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <f.icon className="text-muted-foreground size-5" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground text-xs">{f.label}</dt>
                    <dd className="font-medium">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">About this place</h2>
            <p className="leading-relaxed whitespace-pre-line">{l.description}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Utilities</h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">Water supply</dt>
                <dd>
                  {l.waterSupply.length
                    ? l.waterSupply
                        .map((w) => WATER_SUPPLY_LABELS[w as keyof typeof WATER_SUPPLY_LABELS] ?? w)
                        .join(", ")
                    : "Not specified"}
                </dd>
              </div>
              <div className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">Power backup</dt>
                <dd>{ELECTRICITY_BACKUP_LABELS[l.electricityBackup]}</dd>
              </div>
              <div className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">Cooking gas</dt>
                <dd>{GAS_SUPPLY_LABELS[l.gas]}</dd>
              </div>
              <div className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">Internet</dt>
                <dd>{l.internetAvailable ? "Available" : "Not available"}</dd>
              </div>
              <div className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">Waste collection</dt>
                <dd>{l.wasteCollection ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between border-b py-1">
                <dt className="text-muted-foreground">Parking</dt>
                <dd>
                  {l.parkingBikes} bike · {l.parkingCars} car
                </dd>
              </div>
              {l.areaSqft && l.propertyType === "house" && (
                <div className="flex justify-between border-b py-1">
                  <dt className="text-muted-foreground">Area (R-A-P-D)</dt>
                  <dd>{sqftToRopani(l.areaSqft)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">House rules</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {l.tenantTypes.length > 0 ? (
                l.tenantTypes.map((t) => (
                  <li key={t} className="bg-muted rounded-full px-3 py-1">
                    {TENANT_TYPE_LABELS[t as keyof typeof TENANT_TYPE_LABELS] ?? t} welcome
                  </li>
                ))
              ) : (
                <li className="bg-muted rounded-full px-3 py-1">Open to all tenants</li>
              )}
              <li className="bg-muted rounded-full px-3 py-1">{l.petsAllowed ? "Pets allowed" : "No pets"}</li>
              <li className="bg-muted rounded-full px-3 py-1">{l.smokingAllowed ? "Smoking allowed" : "No smoking"}</li>
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">
              Tenant preferences are set by the landlord and shown for transparency.
            </p>
          </section>

          {l.amenities.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">Amenities</h2>
              <div className="space-y-4">
                {(["basics", "building", "policies", "nearby"] as const).map((cat) =>
                  byCategory[cat]?.length ? (
                    <div key={cat}>
                      <h3 className="text-muted-foreground mb-2 text-sm font-medium capitalize">{cat}</h3>
                      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {byCategory[cat]!.map((a) => (
                          <li key={a.code} className="flex items-center gap-2 text-sm">
                            <AmenityIcon name={a.icon} className="text-primary size-4" />
                            {a.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
            </section>
          )}

          {l.floorPlans.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">Floor plans</h2>
              <FloorPlans plans={l.floorPlans} />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl font-semibold">Location</h2>
            {l.location ? (
              <>
                <ListingMiniMap lat={l.location.lat} lng={l.location.lng} approximate={l.location.approximate} />
                {l.location.approximate && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Approximate area shown for the landlord&apos;s privacy. The exact address is shared when your tour
                    is confirmed.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Location not provided.</p>
            )}
            {l.streetAddress && <p className="mt-2 text-sm">{l.streetAddress}</p>}
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <ShareButtons url={url} title={l.title} />
            {l.status === "published" && !l.isOwner && <ReportButton listingId={l.id} />}
            <p className="text-muted-foreground text-xs">Listing updated {formatDateOnly(l.updatedAt)}</p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ListingSidePanel
            listing={{
              id: l.id,
              slug: l.slug,
              title: l.title,
              rentNpr: l.rentNpr,
              status: l.status,
              isOwner: l.isOwner,
            }}
          />
          <div className="rounded-xl border p-4">
            <p className="text-muted-foreground text-xs">Listed by</p>
            <p className="mt-1 flex items-center gap-1 font-semibold">
              {l.landlord.name}
              {l.landlord.verified && <BadgeCheck className="size-4 text-emerald-600" aria-label="Verified landlord" />}
            </p>
            <p className="text-muted-foreground text-sm">
              Member since {new Date(l.landlord.memberSince).getFullYear()}
              {l.landlord.responseRate != null && ` · ${l.landlord.responseRate}% response rate`}
            </p>
            {!l.landlord.verified && (
              <p className="mt-2 text-xs text-amber-800">
                This landlord hasn&apos;t completed identity verification yet. Never pay a deposit before visiting.
              </p>
            )}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Similar rentals in {l.city.name}</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <li key={s.id}>
                <ListingCard listing={s} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
