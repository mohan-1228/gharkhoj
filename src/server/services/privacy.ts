import { createHash } from "node:crypto";

/**
 * When a landlord chooses "approximate location", never send the true
 * coordinates to browsers. Offset deterministically (stable per listing, so the
 * pin doesn't jump between requests) by up to ~300 m.
 */
const MAX_OFFSET_DEG = 0.0027; // ≈ 300 m latitude

export function publicCoordinates(id: string, lat: number | null, lng: number | null, approximate: boolean) {
  if (lat == null || lng == null) return null;
  if (!approximate) return { lat, lng, approximate: false };
  const h = createHash("sha256").update(`loc:${id}`).digest();
  const dx = (h.readUInt16BE(0) / 0xffff) * 2 - 1;
  const dy = (h.readUInt16BE(2) / 0xffff) * 2 - 1;
  const r = 0.4 + 0.6 * (h.readUInt16BE(4) / 0xffff); // keep a minimum offset
  return {
    lat: Number((lat + dy * r * MAX_OFFSET_DEG).toFixed(5)),
    lng: Number((lng + (dx * r * MAX_OFFSET_DEG) / Math.cos((lat * Math.PI) / 180)).toFixed(5)),
    approximate: true,
  };
}
