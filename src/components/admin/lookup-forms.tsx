"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/forms/field";
import { api, errorMessage } from "@/lib/api-client";

interface CityRow {
  id: number;
  name: string;
  province: string;
  isActive: boolean;
  neighborhoods: number;
  listings: number;
}

export function LookupForms({
  cities,
  amenities,
}: {
  cities: CityRow[];
  amenities: { code: string; label: string; category: string }[];
}) {
  const router = useRouter();
  const [city, setCity] = useState({ name: "", province: "", district: "", latitude: "", longitude: "" });
  const [nb, setNb] = useState({ cityId: String(cities[0]?.id ?? ""), name: "", latitude: "", longitude: "" });
  const [am, setAm] = useState({ code: "", label: "", category: "basics" });

  const submit = async (path: string, body: unknown, msg: string, reset: () => void) => {
    try {
      await api(path, { method: "POST", json: body });
      toast.success(msg);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const num = (s: string) => (s === "" ? undefined : Number(s));

  return (
    <>
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Cities</h2>
        <ul className="mt-3 divide-y text-sm">
          {cities.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>
                {c.name}{" "}
                <span className="text-muted-foreground">
                  · {c.province} · {c.neighborhoods} neighbourhoods · {c.listings} listings
                </span>
              </span>
              <label className="flex items-center gap-2 text-xs">
                Active
                <Switch
                  checked={c.isActive}
                  onCheckedChange={async (v) => {
                    try {
                      await api(`/admin/cities/${c.id}`, { method: "PATCH", json: { isActive: v } });
                      router.refresh();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(
              "/admin/cities",
              { ...city, latitude: Number(city.latitude), longitude: Number(city.longitude), isActive: true },
              "City added",
              () => setCity({ name: "", province: "", district: "", latitude: "", longitude: "" }),
            );
          }}
        >
          <Input
            aria-label="City name"
            placeholder="Name"
            value={city.name}
            onChange={(e) => setCity({ ...city, name: e.target.value })}
            required
          />
          <Input
            aria-label="Province"
            placeholder="Province"
            value={city.province}
            onChange={(e) => setCity({ ...city, province: e.target.value })}
            required
          />
          <Input
            aria-label="District"
            placeholder="District"
            value={city.district}
            onChange={(e) => setCity({ ...city, district: e.target.value })}
            required
          />
          <Input
            aria-label="Latitude"
            placeholder="Lat"
            type="number"
            step="any"
            value={city.latitude}
            onChange={(e) => setCity({ ...city, latitude: e.target.value })}
            required
          />
          <Input
            aria-label="Longitude"
            placeholder="Lng"
            type="number"
            step="any"
            value={city.longitude}
            onChange={(e) => setCity({ ...city, longitude: e.target.value })}
            required
          />
          <Button type="submit">Add city</Button>
        </form>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Add neighbourhood / tole</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(
              "/admin/neighborhoods",
              { cityId: Number(nb.cityId), name: nb.name, latitude: num(nb.latitude), longitude: num(nb.longitude) },
              "Neighbourhood added",
              () => setNb({ ...nb, name: "", latitude: "", longitude: "" }),
            );
          }}
        >
          <NativeSelect aria-label="City" value={nb.cityId} onChange={(e) => setNb({ ...nb, cityId: e.target.value })}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <Input
            aria-label="Neighbourhood name"
            placeholder="Name"
            value={nb.name}
            onChange={(e) => setNb({ ...nb, name: e.target.value })}
            required
          />
          <Input
            aria-label="Latitude"
            placeholder="Lat (optional)"
            type="number"
            step="any"
            value={nb.latitude}
            onChange={(e) => setNb({ ...nb, latitude: e.target.value })}
          />
          <Input
            aria-label="Longitude"
            placeholder="Lng (optional)"
            type="number"
            step="any"
            value={nb.longitude}
            onChange={(e) => setNb({ ...nb, longitude: e.target.value })}
          />
          <Button type="submit">Add</Button>
        </form>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Amenities ({amenities.length})</h2>
        <p className="text-muted-foreground mt-1 text-sm">{amenities.map((a) => a.label).join(" · ")}</p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit("/admin/amenities", am, "Amenity added", () =>
              setAm({ code: "", label: "", category: "basics" }),
            );
          }}
        >
          <Input
            aria-label="Code"
            placeholder="code_like_this"
            pattern="[a-z0-9_]+"
            value={am.code}
            onChange={(e) => setAm({ ...am, code: e.target.value })}
            required
          />
          <Input
            aria-label="Label"
            placeholder="Label"
            value={am.label}
            onChange={(e) => setAm({ ...am, label: e.target.value })}
            required
          />
          <NativeSelect
            aria-label="Category"
            value={am.category}
            onChange={(e) => setAm({ ...am, category: e.target.value })}
          >
            {["basics", "building", "policies", "nearby"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
          <Button type="submit">Add amenity</Button>
        </form>
      </section>
    </>
  );
}
