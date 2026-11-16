import { env } from "../lib/env";
import { logger } from "../lib/logger";

/**
 * Geocoding via OpenStreetMap Nominatim (ADR-0004). Browsers never call
 * Nominatim directly: we proxy, restrict to Nepal, cache results and serialise
 * outgoing requests to ≤1/second as required by the Nominatim usage policy.
 */
export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  type: string;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; results: GeocodeResult[] }>();
let lastCall = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function geocode(query: string, near?: { lat: number; lng: number }): Promise<GeocodeResult[]> {
  const key = `${query.toLowerCase().trim()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.results;

  const url = new URL("/search", env.GEOCODER_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "np");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "en");
  if (near) {
    const d = 0.15; // bias (not restrict) results to ~15 km around the chosen city
    url.searchParams.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }

  try {
    const res = await throttle(() =>
      fetch(url, {
        headers: { "User-Agent": env.GEOCODER_USER_AGENT, Referer: env.APP_URL },
        signal: AbortSignal.timeout(8000),
      }),
    );
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string; type: string }[];
    const results = rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon), type: r.type }));
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), results });
    return results;
  } catch (err) {
    // OSM coverage is thin outside the valley/Pokhara: degrade gracefully to manual pin placement.
    logger.warn({ err, query }, "geocode failed");
    return [];
  }
}
