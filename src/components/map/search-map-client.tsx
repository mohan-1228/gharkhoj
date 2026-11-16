"use client";

import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Crosshair, LocateFixed, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_MAP_CENTER } from "@/lib/constants";
import { formatNprCompact, formatRent } from "@/lib/format";
import type { MapPin } from "@/server/services/search-service";
import { searchParsers } from "@/components/search/search-params";
import { loadMarkerCluster, pricePinIcon, TILE_ATTRIBUTION, TILE_URL } from "./leaflet-setup";

export interface SearchMapProps {
  /** Filter params (already validated server-side) to send to /listings/map. */
  params: Record<string, string>;
  initialCenter?: [number, number];
}

function PinPopup({ pin }: { pin: MapPin }) {
  return (
    <a href={`/listing/${pin.slug}`} className="block w-52 text-inherit no-underline">
      {pin.image && <img src={pin.image} alt="" className="mb-2 aspect-[3/2] w-full rounded object-cover" />}
      <strong className="block text-sm">{formatRent(pin.rentNpr)}</strong>
      <span className="line-clamp-2 block text-xs text-gray-600">{pin.title}</span>
    </a>
  );
}

/** Clustered price pins. Popups are React-rendered into Leaflet containers. */
function ClusterLayer({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const roots = useRef<Root[]>([]);
  useEffect(() => {
    let group: L.MarkerClusterGroup | undefined;
    let cancelled = false;
    void loadMarkerCluster().then(() => {
      if (cancelled) return;
      group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true });
      for (const pin of pins) {
        const marker = L.marker([pin.location.lat, pin.location.lng], {
          icon: pricePinIcon(formatNprCompact(pin.rentNpr)),
          title: `${pin.title} — ${formatRent(pin.rentNpr)}`,
          keyboard: true,
        });
        const el = document.createElement("div");
        const root = createRoot(el);
        root.render(<PinPopup pin={pin} />);
        roots.current.push(root);
        marker.bindPopup(el, { closeButton: false, offset: [0, -4] });
        marker.on("mouseover", () => marker.setIcon(pricePinIcon(formatNprCompact(pin.rentNpr), true)));
        marker.on("mouseout", () => marker.setIcon(pricePinIcon(formatNprCompact(pin.rentNpr))));
        group.addLayer(marker);
      }
      map.addLayer(group);
    });
    return () => {
      cancelled = true;
      if (group) map.removeLayer(group);
      const old = roots.current;
      roots.current = [];
      setTimeout(() => old.forEach((r) => r.unmount()), 0);
    };
  }, [map, pins]);
  return null;
}

function FitToBbox({ bbox, pins, fallback }: { bbox?: string; pins: MapPin[]; fallback?: [number, number] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    if (bbox) {
      const [s, w, n, e] = bbox.split(",").map(Number) as [number, number, number, number];
      map.fitBounds([
        [s, w],
        [n, e],
      ]);
      done.current = true;
    } else if (pins.length) {
      map.fitBounds(L.latLngBounds(pins.map((p) => [p.location.lat, p.location.lng])).pad(0.15), { maxZoom: 15 });
      done.current = true;
    } else if (fallback) {
      map.setView(fallback, 13);
    }
  }, [bbox, pins, fallback, map]);
  return null;
}

/** Report viewport changes only after the user has interacted (ignores programmatic fitBounds). */
function MoveWatcher({ onMoved }: { onMoved: (b: L.LatLngBounds, c: L.LatLng) => void }) {
  const interacted = useRef(false);
  const map = useMapEvents({
    dragstart: () => (interacted.current = true),
    moveend: () => interacted.current && onMoved(map.getBounds(), map.getCenter()),
  });
  useEffect(() => {
    const el = map.getContainer();
    const mark = () => (interacted.current = true);
    el.addEventListener("wheel", mark, { passive: true });
    el.addEventListener("touchstart", mark, { passive: true });
    el.addEventListener("keydown", mark);
    el.addEventListener("dblclick", mark);
    const zoomButtons = el.querySelector(".leaflet-control-zoom");
    zoomButtons?.addEventListener("click", mark);
    return () => {
      el.removeEventListener("wheel", mark);
      el.removeEventListener("touchstart", mark);
      el.removeEventListener("keydown", mark);
      el.removeEventListener("dblclick", mark);
      zoomButtons?.removeEventListener("click", mark);
    };
  }, [map]);
  return null;
}

export default function SearchMapClient({ params, initialCenter }: SearchMapProps) {
  const [, setF] = useQueryStates(searchParsers, { shallow: false, history: "push" });
  const [moved, setMoved] = useState<{ bounds: L.LatLngBounds; center: L.LatLng } | null>(null);
  const qs = useMemo(() => new URLSearchParams(params).toString(), [params]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["map-pins", qs],
    queryFn: async () => {
      const res = await fetch(`/api/v1/listings/map?${qs}`);
      if (!res.ok) throw new Error("Failed to load map");
      return (await res.json()) as { items: MapPin[] };
    },
    placeholderData: (prev) => prev,
  });
  const pins = data?.items ?? [];

  const searchArea = () => {
    if (!moved) return;
    const b = moved.bounds;
    const bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((n) => n.toFixed(5)).join(",");
    void setF({ bbox, lat: null, lng: null, radiusKm: null, page: null });
    setMoved(null);
  };

  const radiusSearch = (km: number, center: { lat: number; lng: number }) => {
    void setF({
      lat: Number(center.lat.toFixed(5)),
      lng: Number(center.lng.toFixed(5)),
      radiusKm: km,
      bbox: null,
      sort: "nearest",
      page: null,
    });
    setMoved(null);
  };

  return (
    <div className="relative">
      <MapContainer
        center={initialCenter ?? DEFAULT_MAP_CENTER}
        zoom={12}
        className="h-[65vh] min-h-[420px] w-full rounded-xl border"
        scrollWheelZoom
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToBbox bbox={params.bbox} pins={pins} fallback={initialCenter} />
        <ClusterLayer pins={pins} />
        <MoveWatcher onMoved={(bounds, center) => setMoved({ bounds, center })} />
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center gap-2">
        {moved && (
          <Button size="sm" className="pointer-events-auto shadow-md" onClick={searchArea}>
            <RefreshCw className="size-4" /> Search this area
          </Button>
        )}
        {moved && (
          <Button
            size="sm"
            variant="secondary"
            className="pointer-events-auto shadow-md"
            onClick={() => radiusSearch(2, moved.center)}
          >
            <Crosshair className="size-4" /> Within 2 km of centre
          </Button>
        )}
      </div>
      <div className="absolute right-3 bottom-6 z-[500]">
        <Button
          size="sm"
          variant="secondary"
          className="shadow-md"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (pos) => radiusSearch(3, { lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => undefined,
              { enableHighAccuracy: false, timeout: 8000 },
            )
          }
        >
          <LocateFixed className="size-4" /> Near me
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs" aria-live="polite">
        {isError
          ? "Couldn't load map pins. Check your connection."
          : isFetching
            ? "Loading pins…"
            : `${pins.length} rental${pins.length === 1 ? "" : "s"} on the map`}
        {pins.length >= 500 && " (zoom in to see more)"}
      </p>
    </div>
  );
}
