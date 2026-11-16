"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Tile layer config — swap NEXT_PUBLIC_MAP_TILE_URL for a commercial OSM tile host at scale. */
export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? "&copy; OpenStreetMap contributors";

/** leaflet.markercluster is a UMD plugin that augments the global `L`. Load it lazily, once. */
let clusterReady: Promise<void> | null = null;
export function loadMarkerCluster(): Promise<void> {
  if (!clusterReady) {
    (window as unknown as { L: typeof L }).L = L;
    clusterReady = import("leaflet.markercluster").then(() => undefined);
  }
  return clusterReady;
}

/** Text-free pin used for single-location maps (avoids broken default icon URLs in bundlers). */
export const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 26 15 40 15 40s15-14 15-25.2C30 6.6 23.3 0 15 0z" fill="#b91c1c"/><circle cx="15" cy="15" r="6" fill="#fff"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

export function pricePinIcon(label: string, active = false) {
  return L.divIcon({
    className: "",
    html: `<div class="price-pin${active ? " active" : ""}">${label}</div>`,
    iconSize: undefined,
    iconAnchor: [24, 12],
  });
}
