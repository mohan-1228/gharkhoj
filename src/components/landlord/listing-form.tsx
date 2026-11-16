"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckboxItem, Field, FormSection, NativeSelect } from "@/components/forms/field";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import {
  ELECTRICITY_BACKUP,
  ELECTRICITY_BACKUP_LABELS,
  FACING,
  FURNISHING,
  FURNISHING_LABELS,
  GAS_SUPPLY,
  GAS_SUPPLY_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  TENANT_TYPES,
  TENANT_TYPE_LABELS,
  WATER_SUPPLY,
  WATER_SUPPLY_LABELS,
} from "@/lib/constants";
import { createListingSchema, type CreateListingInput, type ListingFormValues } from "@/schemas/listing";
import { LocationPicker } from "./location-picker";

export interface LookupData {
  cities: { id: number; name: string; lat: number | null; lng: number | null }[];
  neighborhoods: { id: number; cityId: number; name: string; lat: number | null; lng: number | null }[];
  amenities: { code: string; label: string; category: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  basics: "Basics",
  building: "Building",
  policies: "Policies",
  nearby: "Nearby",
};

export function ListingForm({
  mode,
  listingId,
  defaultValues,
  lookups,
}: {
  mode: "create" | "edit";
  listingId?: string;
  defaultValues: Partial<ListingFormValues>;
  lookups: LookupData;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const form = useForm<ListingFormValues, unknown, CreateListingInput>({
    resolver: zodResolver(createListingSchema),
    defaultValues,
    mode: "onBlur",
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = form;

  const cityId = Number(watch("cityId"));
  const neighborhoods = useMemo(
    () => lookups.neighborhoods.filter((n) => n.cityId === cityId),
    [lookups.neighborhoods, cityId],
  );
  const amenitiesByCategory = useMemo(() => {
    const groups: Record<string, LookupData["amenities"]> = {};
    for (const a of lookups.amenities) (groups[a.category] ??= []).push(a);
    return groups;
  }, [lookups.amenities]);

  const err = (name: FieldPath<ListingFormValues>) => {
    const parts = name.split(".");
    let cur: unknown = errors;
    for (const p of parts) cur = (cur as Record<string, unknown> | undefined)?.[p];
    return (cur as { message?: string } | undefined)?.message;
  };
  const aria = (name: FieldPath<ListingFormValues>) => ({
    id: name,
    "aria-invalid": err(name) ? true : undefined,
    "aria-describedby": err(name) ? `${name}-error` : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await api<{ id: string }>("/listings", { method: "POST", json: values });
        toast.success("Draft saved. Now add photos.");
        router.push(`/landlord/listings/${res.id}/edit#media`);
      } else {
        const res = await api<{ status: string }>(`/listings/${listingId}`, { method: "PATCH", json: values });
        toast.success(
          res.status === "pending_review" ? "Saved. Your changes will be reviewed before going live." : "Changes saved",
        );
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiError && e.details?.fields) {
        for (const f of e.details.fields) setError(f.path as FieldPath<ListingFormValues>, { message: f.message });
      }
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  });

  const lat = watch("latitude");
  const lng = watch("longitude");
  const nbId = Number(watch("neighborhoodId"));
  const fallbackCenter = (() => {
    const nb = lookups.neighborhoods.find((n) => n.id === nbId);
    if (nb?.lat && nb.lng) return [nb.lat, nb.lng] as [number, number];
    const c = lookups.cities.find((x) => x.id === cityId);
    if (c?.lat && c.lng) return [c.lat, c.lng] as [number, number];
    return undefined;
  })();

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormSection title="Basics" description="What are you renting out?">
        <Field
          id="title"
          label="Title"
          required
          error={err("title")}
          hint="e.g. Sunny 2BHK flat with parking near Baneshwor chowk"
          className="sm:col-span-2"
        >
          <Input {...register("title")} {...aria("title")} maxLength={120} />
        </Field>
        <Field id="propertyType" label="Property type" required error={err("propertyType")}>
          <NativeSelect {...register("propertyType")} {...aria("propertyType")}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="furnishing" label="Furnishing" error={err("furnishing")}>
          <NativeSelect {...register("furnishing")} {...aria("furnishing")}>
            {FURNISHING.map((f) => (
              <option key={f} value={f}>
                {FURNISHING_LABELS[f]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          id="description"
          label="Description"
          required
          error={err("description")}
          className="sm:col-span-2"
          hint="Mention water, sunlight, road access, nearby landmarks and house rules."
        >
          <Textarea rows={6} {...register("description")} {...aria("description")} maxLength={5000} />
        </Field>
      </FormSection>

      <FormSection title="Price & lease">
        <Field id="rentNpr" label="Monthly rent (NPR)" required error={err("rentNpr")}>
          <Input type="number" inputMode="numeric" min={0} step={500} {...register("rentNpr")} {...aria("rentNpr")} />
        </Field>
        <Field id="depositNpr" label="Security deposit (NPR)" error={err("depositNpr")} hint="Usually 1–3 months' rent">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            {...register("depositNpr")}
            {...aria("depositNpr")}
          />
        </Field>
        <Field id="availableFrom" label="Available from" required error={err("availableFrom")}>
          <Input type="date" {...register("availableFrom")} {...aria("availableFrom")} />
        </Field>
        <Field id="minLeaseMonths" label="Minimum lease (months)" error={err("minLeaseMonths")}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            {...register("minLeaseMonths")}
            {...aria("minLeaseMonths")}
          />
        </Field>
        <div className="sm:col-span-2">
          <CheckboxItem label="Rent is negotiable" {...register("negotiable")} />
        </div>
      </FormSection>

      <FormSection title="Details">
        <Field id="bedrooms" label="Bedrooms" required error={err("bedrooms")} hint="0 for a studio or office">
          <Input type="number" inputMode="numeric" min={0} max={20} {...register("bedrooms")} {...aria("bedrooms")} />
        </Field>
        <Field id="bathrooms" label="Bathrooms" required error={err("bathrooms")}>
          <Input type="number" inputMode="numeric" min={0} max={20} {...register("bathrooms")} {...aria("bathrooms")} />
        </Field>
        <Field id="areaSqft" label="Total area (sq ft)" error={err("areaSqft")}>
          <Input type="number" inputMode="numeric" min={0} {...register("areaSqft")} {...aria("areaSqft")} />
        </Field>
        <Field id="facing" label="Facing direction" error={err("facing")}>
          <NativeSelect {...register("facing", { setValueAs: (v) => (v === "" ? null : v) })} {...aria("facing")}>
            <option value="">Not specified</option>
            {FACING.map((f) => (
              <option key={f} value={f}>
                {f.replace("_", "-").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="floorNo" label="Floor number" error={err("floorNo")} hint="0 = ground floor">
          <Input type="number" inputMode="numeric" {...register("floorNo")} {...aria("floorNo")} />
        </Field>
        <Field id="totalFloors" label="Total floors in building" error={err("totalFloors")}>
          <Input type="number" inputMode="numeric" min={1} {...register("totalFloors")} {...aria("totalFloors")} />
        </Field>
        <Field id="parkingBikes" label="Bike parking spots" error={err("parkingBikes")}>
          <Input type="number" inputMode="numeric" min={0} {...register("parkingBikes")} {...aria("parkingBikes")} />
        </Field>
        <Field id="parkingCars" label="Car parking spots" error={err("parkingCars")}>
          <Input type="number" inputMode="numeric" min={0} {...register("parkingCars")} {...aria("parkingCars")} />
        </Field>
        <Field id="yearBuilt" label="Year built (AD)" error={err("yearBuilt")}>
          <Input type="number" inputMode="numeric" {...register("yearBuilt")} {...aria("yearBuilt")} />
        </Field>
      </FormSection>

      <FormSection title="Utilities" description="Water and power backup are the first things renters ask about.">
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Water supply</legend>
          <div className="flex flex-wrap gap-2">
            {WATER_SUPPLY.map((w) => (
              <CheckboxItem key={w} label={WATER_SUPPLY_LABELS[w]} value={w} {...register("waterSupply")} />
            ))}
          </div>
        </fieldset>
        <Field id="electricityBackup" label="Electricity backup">
          <NativeSelect {...register("electricityBackup")} id="electricityBackup">
            {ELECTRICITY_BACKUP.map((e) => (
              <option key={e} value={e}>
                {ELECTRICITY_BACKUP_LABELS[e]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="gas" label="Cooking gas">
          <NativeSelect {...register("gas")} id="gas">
            {GAS_SUPPLY.map((g) => (
              <option key={g} value={g}>
                {GAS_SUPPLY_LABELS[g]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <CheckboxItem label="Internet available" {...register("internetAvailable")} />
        <CheckboxItem label="Waste collection service" {...register("wasteCollection")} />
      </FormSection>

      <FormSection title="Who can rent" description="Shown transparently to renters as your stated tenant preferences.">
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Preferred tenants</legend>
          <div className="flex flex-wrap gap-2">
            {TENANT_TYPES.map((t) => (
              <CheckboxItem key={t} label={TENANT_TYPE_LABELS[t]} value={t} {...register("tenantTypes")} />
            ))}
          </div>
        </fieldset>
        <CheckboxItem label="Pets allowed" {...register("petsAllowed")} />
        <CheckboxItem label="Smoking allowed" {...register("smokingAllowed")} />
      </FormSection>

      <FormSection
        title="Location"
        description="Many places lack street numbers — the map pin and a landmark help renters most."
      >
        <Field id="cityId" label="City" required error={err("cityId")}>
          <NativeSelect
            {...register("cityId", {
              onChange: () => setValue("neighborhoodId", null),
            })}
            {...aria("cityId")}
          >
            <option value="">Choose a city</option>
            {lookups.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="neighborhoodId" label="Neighbourhood / tole" error={err("neighborhoodId")}>
          <NativeSelect
            {...register("neighborhoodId", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
            {...aria("neighborhoodId")}
            disabled={!cityId}
          >
            <option value="">Not listed / other</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="wardNo" label="Ward no." error={err("wardNo")}>
          <Input type="number" inputMode="numeric" min={1} max={40} {...register("wardNo")} {...aria("wardNo")} />
        </Field>
        <Field id="landmark" label="Landmark" error={err("landmark")} hint="e.g. 200m north of Bhatbhateni Supermarket">
          <Input {...register("landmark")} {...aria("landmark")} />
        </Field>
        <Field id="streetAddress" label="Street / tole address" error={err("streetAddress")} className="sm:col-span-2">
          <Input {...register("streetAddress")} {...aria("streetAddress")} />
        </Field>
        <div className="sm:col-span-2">
          <LocationPicker
            value={
              lat != null && lng != null && lat !== ("" as unknown) ? { lat: Number(lat), lng: Number(lng) } : null
            }
            fallbackCenter={fallbackCenter}
            onChange={(p) => {
              setValue("latitude", p?.lat ?? null, { shouldDirty: true, shouldValidate: true });
              setValue("longitude", p?.lng ?? null, { shouldDirty: true, shouldValidate: true });
            }}
          />
          {err("latitude") && (
            <p role="alert" className="text-destructive mt-1 text-xs">
              {err("latitude")}
            </p>
          )}
          <div className="mt-3">
            <CheckboxItem
              label="Show approximate location only (recommended for privacy)"
              {...register("locationIsApproximate")}
            />
          </div>
        </div>
      </FormSection>

      <section className="bg-card rounded-xl border p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Amenities</h2>
        <div className="mt-4 space-y-4">
          {Object.entries(amenitiesByCategory).map(([cat, items]) => (
            <fieldset key={cat}>
              <legend className="mb-2 text-sm font-medium">{CATEGORY_LABELS[cat] ?? cat}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <CheckboxItem key={a.code} label={a.label} value={a.code} {...register("amenityCodes")} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="bg-background/95 sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => router.push("/landlord/listings")}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Save draft & continue" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
