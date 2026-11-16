"use client";

import { Circle, MapContainer, Marker, TileLayer } from "react-leaflet";
import { pinIcon, TILE_ATTRIBUTION, TILE_URL } from "./leaflet-setup";

/** Listing location: exact pin, or a ~400m circle when the landlord chose approximate. */
export default function ListingMiniMapClient({
  lat,
  lng,
  approximate,
}: {
  lat: number;
  lng: number;
  approximate: boolean;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={approximate ? 15 : 16}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-xl border sm:h-80"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {approximate ? (
        <Circle
          center={[lat, lng]}
          radius={400}
          pathOptions={{ color: "#b91c1c", fillColor: "#b91c1c", fillOpacity: 0.15 }}
        />
      ) : (
        <Marker position={[lat, lng]} icon={pinIcon} />
      )}
    </MapContainer>
  );
}
