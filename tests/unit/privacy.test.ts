// @vitest-environment node
import { describe, expect, it } from "vitest";
import { publicCoordinates } from "@/server/services/privacy";

const haversineM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000,
    r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r,
    dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

describe("publicCoordinates", () => {
  const exact = { lat: 27.7172, lng: 85.324 };
  it("returns exact coordinates when the landlord opted in", () => {
    expect(publicCoordinates("a", exact.lat, exact.lng, false)).toEqual({ ...exact, approximate: false });
  });
  it("offsets approximate locations by a bounded, non-trivial distance", () => {
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      const p = publicCoordinates(id, exact.lat, exact.lng, true)!;
      const d = haversineM(exact, p);
      expect(d).toBeGreaterThan(50);
      expect(d).toBeLessThan(450);
    }
  });
  it("is stable per listing so pins do not jump between requests", () => {
    expect(publicCoordinates("same", exact.lat, exact.lng, true)).toEqual(
      publicCoordinates("same", exact.lat, exact.lng, true),
    );
  });
  it("handles missing location", () => {
    expect(publicCoordinates("x", null, null, true)).toBeNull();
  });
});
