"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("./listing-mini-map-client"), {
  ssr: false,
  loading: () => <div className="bg-muted h-64 w-full animate-pulse rounded-xl sm:h-80" />,
});

export function ListingMiniMap(props: { lat: number; lng: number; approximate: boolean }) {
  return (
    <div>
      <MapClient {...props} />
      <a
        href={`https://www.openstreetmap.org/?mlat=${props.lat}&mlon=${props.lng}#map=15/${props.lat}/${props.lng}`}
        target="_blank"
        rel="noreferrer"
        className="text-primary mt-1 inline-block text-xs hover:underline"
      >
        Open in OpenStreetMap
      </a>
    </div>
  );
}
