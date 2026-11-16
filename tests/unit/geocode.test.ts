// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

describe("geocode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("restricts to Nepal, maps results and caches them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ display_name: "Thamel, Kathmandu", lat: "27.71", lon: "85.31", type: "suburb" }]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { geocode } = await import("@/server/services/geocode-service");
    const r1 = await geocode("Thamel unique-1");
    const r2 = await geocode("thamel UNIQUE-1 ");
    expect(r1).toEqual([{ label: "Thamel, Kathmandu", lat: 27.71, lng: 85.31, type: "suburb" }]);
    expect(r2).toEqual(r1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]![0] as URL;
    expect(url.searchParams.get("countrycodes")).toBe("np");
  });

  it("degrades to an empty list when Nominatim fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { geocode } = await import("@/server/services/geocode-service");
    expect(await geocode("unreachable-place-xyz")).toEqual([]);
  });
});
