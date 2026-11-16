/** Placeholder until Leaflet lands (phase 4). */
export function ListingMiniMap({ lat, lng }: { lat: number; lng: number; approximate: boolean }) {
  return (
    <a
      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
      target="_blank"
      rel="noreferrer"
      className="text-primary flex h-48 items-center justify-center rounded-xl border border-dashed text-sm hover:underline"
    >
      View on OpenStreetMap
    </a>
  );
}
