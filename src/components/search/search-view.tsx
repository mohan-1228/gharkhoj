import { getTranslations } from "next-intl/server";
import { searchQuerySchema, type SearchQuery } from "@/schemas/search";
import { search } from "@/server/services/search-service";
import { getAmenities, getCities, getNeighborhoods } from "@/server/services/lookup-service";
import { ListingCard } from "@/components/listings/listing-card";
import { Filters, type FilterLookups } from "./filters";
import { SortSelect } from "./sort-select";
import { Pagination } from "./pagination";
import type { ReactNode } from "react";

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Parse untrusted URL params; invalid values are dropped rather than erroring the page. */
export function parseSearchParams(raw: RawSearchParams, fixed: Partial<SearchQuery> = {}): SearchQuery {
  const parsed = searchQuerySchema.safeParse({ ...raw, ...fixed });
  if (parsed.success) return parsed.data;
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([k]) => !bad.has(k)));
  return searchQuerySchema.parse({ ...cleaned, ...fixed });
}

const FILTER_KEYS = [
  "q",
  "neighborhood",
  "type",
  "minPrice",
  "maxPrice",
  "beds",
  "baths",
  "furnishing",
  "amenities",
  "tenant",
  "pets",
  "parking",
  "availableBy",
  "minArea",
  "maxArea",
  "bbox",
  "radiusKm",
] as const;

export async function getFilterLookups(): Promise<FilterLookups> {
  const [cities, neighborhoods, amenities] = await Promise.all([getCities(), getNeighborhoods(), getAmenities()]);
  const cityById = new Map(cities.map((c) => [c.id, c.slug]));
  return {
    cities: cities.map((c) => ({ slug: c.slug, name: c.name })),
    neighborhoods: neighborhoods.map((n) => ({ slug: n.slug, name: n.name, citySlug: cityById.get(n.cityId) ?? "" })),
    amenities: amenities.map((a) => ({ code: a.code, label: a.label, category: a.category })),
  };
}

export async function SearchView({
  raw,
  fixed = {},
  basePath,
  heading,
  intro,
  mapSlot,
}: {
  raw: RawSearchParams;
  fixed?: Partial<SearchQuery>;
  basePath: string;
  heading: string;
  intro?: ReactNode;
  mapSlot?: (q: SearchQuery) => ReactNode;
}) {
  const t = await getTranslations("search");
  const q = parseSearchParams(raw, fixed);
  const [result, lookups] = await Promise.all([search(q), getFilterLookups()]);
  const activeCount = FILTER_KEYS.filter((k) => raw[k] !== undefined && raw[k] !== "").length;
  const isMap = raw.view === "map";

  const hrefFor = (page: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined || k === "page") continue;
      for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item);
    }
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1>
        {intro && <div className="text-muted-foreground mt-1 text-sm">{intro}</div>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Filters lookups={lookups} fixedCity={fixed.city} activeCount={activeCount} />
        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p id="results-heading" className="text-sm font-medium" aria-live="polite">
              {t("results", { count: result.total })}
            </p>
            <div className="flex items-center gap-2">
              {mapSlot && (
                <ViewToggle
                  isMap={isMap}
                  hrefList={hrefWithView(raw, basePath, null)}
                  hrefMap={hrefWithView(raw, basePath, "map")}
                />
              )}
              <SortSelect canSortByDistance={q.lat != null && q.lng != null} />
            </div>
          </div>

          {isMap && mapSlot ? (
            mapSlot(q)
          ) : result.items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-medium">No rentals match these filters.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Try widening the price range, removing amenities or choosing a nearby neighbourhood.
              </p>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((l, i) => (
                  <li key={l.id}>
                    <ListingCard listing={l} priority={i < 2} />
                  </li>
                ))}
              </ul>
              <Pagination page={result.page} pages={result.pages} hrefFor={hrefFor} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function hrefWithView(raw: RawSearchParams, basePath: string, view: "map" | null): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || k === "view" || k === "page") continue;
    for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item);
  }
  if (view) sp.set("view", view);
  const s = sp.toString();
  return s ? `${basePath}?${s}` : basePath;
}

function ViewToggle({ isMap, hrefList, hrefMap }: { isMap: boolean; hrefList: string; hrefMap: string }) {
  const base = "px-3 py-1 text-sm rounded-md";
  return (
    <div className="flex rounded-lg border p-0.5" role="group" aria-label="Results view">
      <a
        href={hrefList}
        aria-current={!isMap ? "page" : undefined}
        className={`${base} ${!isMap ? "bg-primary text-primary-foreground" : ""}`}
      >
        List
      </a>
      <a
        href={hrefMap}
        aria-current={isMap ? "page" : undefined}
        className={`${base} ${isMap ? "bg-primary text-primary-foreground" : ""}`}
      >
        Map
      </a>
    </div>
  );
}
