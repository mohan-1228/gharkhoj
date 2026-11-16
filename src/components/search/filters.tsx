"use client";

import { useQueryStates } from "nuqs";
import { useEffect, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NativeSelect } from "@/components/forms/field";
import {
  FURNISHING,
  FURNISHING_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  TENANT_TYPES,
  TENANT_TYPE_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { searchParsers } from "./search-params";

export interface FilterLookups {
  cities: { slug: string; name: string }[];
  neighborhoods: { slug: string; name: string; citySlug: string }[];
  amenities: { code: string; label: string; category: string }[];
}

const KEY_AMENITIES = [
  "water_24h",
  "power_backup",
  "wifi",
  "hot_water",
  "attached_bath",
  "kitchen",
  "balcony",
  "elevator",
  "cctv",
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function toggle(list: string[] | null, value: string): string[] | null {
  const set = new Set(list ?? []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return set.size ? [...set] : null;
}

function FilterBody({ lookups, fixedCity }: { lookups: FilterLookups; fixedCity?: string }) {
  const [isPending, startTransition] = useTransition();
  const [f, setF] = useQueryStates(searchParsers, { shallow: false, history: "push", startTransition });
  const set = (patch: Partial<typeof f>) => setF({ ...patch, page: null });

  // Debounced text/number inputs so typing doesn't fire a request per keystroke.
  const [q, setQ] = useState(f.q ?? "");
  const [minPrice, setMinPrice] = useState(f.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(f.maxPrice?.toString() ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      const next = {
        q: q || null,
        minPrice: minPrice ? Number(minPrice) : null,
        maxPrice: maxPrice ? Number(maxPrice) : null,
      };
      if (next.q !== f.q || next.minPrice !== f.minPrice || next.maxPrice !== f.maxPrice) void set(next);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to local input changes
  }, [q, minPrice, maxPrice]);

  const city = fixedCity ?? f.city;
  const neighborhoods = lookups.neighborhoods.filter((n) => n.citySlug === city);
  const amenityOptions = lookups.amenities.filter((a) => KEY_AMENITIES.includes(a.code));

  return (
    <div className={cn("space-y-6", isPending && "opacity-70")} aria-busy={isPending}>
      <div className="space-y-1.5">
        <label htmlFor="f-q" className="text-sm font-medium">
          Keyword
        </label>
        <Input
          id="f-q"
          type="search"
          placeholder="e.g. balcony, near school"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!fixedCity && (
        <div className="space-y-1.5">
          <label htmlFor="f-city" className="text-sm font-medium">
            City
          </label>
          <NativeSelect
            id="f-city"
            value={f.city ?? ""}
            onChange={(e) => set({ city: e.target.value || null, neighborhood: null, bbox: null })}
          >
            <option value="">All cities</option>
            {lookups.cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {city && neighborhoods.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="f-nb" className="text-sm font-medium">
            Neighbourhood
          </label>
          <NativeSelect
            id="f-nb"
            value={f.neighborhood ?? ""}
            onChange={(e) => set({ neighborhood: e.target.value || null })}
          >
            <option value="">Anywhere in the city</option>
            {neighborhoods.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Property type</legend>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((t) => (
            <Chip key={t} active={!!f.type?.includes(t)} onClick={() => set({ type: toggle(f.type, t) })}>
              {PROPERTY_TYPE_LABELS[t]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Monthly rent (NPR)</legend>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minimum rent"
            type="number"
            inputMode="numeric"
            placeholder="Min"
            min={0}
            step={1000}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <span aria-hidden>–</span>
          <Input
            aria-label="Maximum rent"
            type="number"
            inputMode="numeric"
            placeholder="Max"
            min={0}
            step={1000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            [null, 10000],
            [10000, 25000],
            [25000, 50000],
            [50000, null],
          ].map(([lo, hi]) => (
            <Chip
              key={`${lo}-${hi}`}
              active={f.minPrice === lo && f.maxPrice === hi}
              onClick={() => {
                setMinPrice(lo?.toString() ?? "");
                setMaxPrice(hi?.toString() ?? "");
              }}
            >
              {lo == null ? `Under ${hi! / 1000}K` : hi == null ? `${lo / 1000}K+` : `${lo / 1000}K–${hi / 1000}K`}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Bedrooms</legend>
        <div className="flex flex-wrap gap-2">
          {[null, 1, 2, 3, 4].map((b) => (
            <Chip key={String(b)} active={f.beds === b} onClick={() => set({ beds: b })}>
              {b == null ? "Any" : `${b}+`}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Bathrooms</legend>
        <div className="flex flex-wrap gap-2">
          {[null, 1, 2, 3].map((b) => (
            <Chip key={String(b)} active={f.baths === b} onClick={() => set({ baths: b })}>
              {b == null ? "Any" : `${b}+`}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Furnishing</legend>
        <div className="flex flex-wrap gap-2">
          {FURNISHING.map((x) => (
            <Chip
              key={x}
              active={!!f.furnishing?.includes(x)}
              onClick={() => set({ furnishing: toggle(f.furnishing, x) })}
            >
              {FURNISHING_LABELS[x]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tenant type accepted</legend>
        <div className="flex flex-wrap gap-2">
          {TENANT_TYPES.map((x) => (
            <Chip key={x} active={!!f.tenant?.includes(x)} onClick={() => set({ tenant: toggle(f.tenant, x) })}>
              {TENANT_TYPE_LABELS[x]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Must have</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={!!f.pets} onClick={() => set({ pets: f.pets ? null : true })}>
            Pet-friendly
          </Chip>
          <Chip active={!!f.parking} onClick={() => set({ parking: f.parking ? null : true })}>
            Parking
          </Chip>
          {amenityOptions.map((a) => (
            <Chip
              key={a.code}
              active={!!f.amenities?.includes(a.code)}
              onClick={() => set({ amenities: toggle(f.amenities, a.code) })}
            >
              {a.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <label htmlFor="f-avail" className="text-sm font-medium">
            Move in by
          </label>
          <Input
            id="f-avail"
            type="date"
            value={f.availableBy ?? ""}
            onChange={(e) => set({ availableBy: e.target.value || null })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="f-minarea" className="text-sm font-medium">
            Min area (sq ft)
          </label>
          <Input
            id="f-minarea"
            type="number"
            inputMode="numeric"
            defaultValue={f.minArea ?? ""}
            onBlur={(e) => set({ minArea: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="f-maxarea" className="text-sm font-medium">
            Max area (sq ft)
          </label>
          <Input
            id="f-maxarea"
            type="number"
            inputMode="numeric"
            defaultValue={f.maxArea ?? ""}
            onBlur={(e) => set({ maxArea: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          setQ("");
          setMinPrice("");
          setMaxPrice("");
          void setF(
            Object.fromEntries(
              Object.keys(searchParsers)
                .filter((k) => k !== "view")
                .map((k) => [k, null]),
            ),
          );
        }}
      >
        <X className="size-4" /> Clear all filters
      </Button>
    </div>
  );
}

export function Filters({
  lookups,
  fixedCity,
  activeCount,
}: {
  lookups: FilterLookups;
  fixedCity?: string;
  activeCount: number;
}) {
  return (
    <>
      <aside className="hidden lg:block" aria-label="Search filters">
        <FilterBody lookups={lookups} fixedCity={fixedCity} />
      </aside>
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="size-4" /> Filters{activeCount > 0 && ` (${activeCount})`}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[90vw] max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-8">
              <FilterBody lookups={lookups} fixedCity={fixedCity} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
