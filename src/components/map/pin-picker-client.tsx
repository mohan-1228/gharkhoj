"use client";

import type L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_MAP_CENTER } from "@/lib/constants";
import { pinIcon, TILE_ATTRIBUTION, TILE_URL } from "./leaflet-setup";

export interface PinPickerProps {
  value: { lat: number; lng: number } | null;
  fallbackCenter?: [number, number];
  onChange: (p: { lat: number; lng: number } | null) => void;
}

const round = (n: number) => Number(n.toFixed(6));

function ClickToPlace({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }) });
  return null;
}

function Recenter({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

/** Click or drag to set the exact pin. Address search is optional — OSM is thin outside major cities. */
export default function PinPickerClient({ value, fallbackCenter, onChange }: PinPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!value && fallbackCenter) setFocus(fallbackCenter);
  }, [fallbackCenter, value]);

  async function runSearch() {
    if (query.trim().length < 3) return;
    setSearching(true);
    setMessage(null);
    try {
      const sp = new URLSearchParams({ q: query });
      if (fallbackCenter) {
        sp.set("lat", String(fallbackCenter[0]));
        sp.set("lng", String(fallbackCenter[1]));
      }
      const res = await fetch(`/api/v1/geocode?${sp}`);
      const data = (await res.json()) as { items?: { label: string; lat: number; lng: number }[] };
      setResults(data.items ?? []);
      if (!data.items?.length) setMessage("No match found. Tap the map to place the pin manually.");
    } catch {
      setMessage("Search is unavailable. Tap the map to place the pin manually.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          aria-label="Search for a landmark or address"
          placeholder="Search a landmark, e.g. Bhatbhateni Maharajgunj"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={runSearch} disabled={searching}>
          <Search className="size-4" /> {searching ? "Searching…" : "Find"}
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-md border text-sm" role="listbox" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="hover:bg-muted w-full px-3 py-2 text-left"
                onClick={() => {
                  onChange({ lat: round(r.lat), lng: round(r.lng) });
                  setFocus([r.lat, r.lng]);
                  setResults([]);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="text-muted-foreground text-xs">{message}</p>}
      <MapContainer
        center={value ? [value.lat, value.lng] : (fallbackCenter ?? DEFAULT_MAP_CENTER)}
        zoom={value ? 16 : 13}
        className="h-72 w-full rounded-lg border"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <ClickToPlace onPick={onChange} />
        <Recenter center={focus} zoom={16} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onChange({ lat: round(ll.lat), lng: round(ll.lng) });
              },
            }}
          />
        )}
      </MapContainer>
      <p className="text-muted-foreground text-xs">
        {value
          ? `Pin: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag to adjust.`
          : "Tap the map where the property is."}
        {value && (
          <button type="button" className="text-primary ml-2 underline" onClick={() => onChange(null)}>
            Remove pin
          </button>
        )}
      </p>
    </div>
  );
}
