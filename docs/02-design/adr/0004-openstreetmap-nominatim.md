# ADR-0004: OpenStreetMap tiles + Nominatim for maps and geocoding

**Status:** Accepted (chosen by the product owner) · **Date:** 2026-11-15 · Resolves CLAUDE.md §12.3

## Context

Commercial map coverage in Nepal is uneven outside Kathmandu Valley and Pokhara; OSM data is often better there and free.

## Decision

- **Leaflet + OSM raster tiles** in the browser (tile URL configurable via `NEXT_PUBLIC_MAP_TILE_URL`).
- **Nominatim** for landmark/address search, **proxied by our server** (`/api/v1/geocode`): Nepal-only (`countrycodes=np`), biased to the selected city, 24 h in-memory cache, requests serialised to ≤ 1/s with an identifying User-Agent (per the Nominatim usage policy).
- Manual pin placement is the primary input; geocoding is a convenience that fails gracefully.

## Consequences

- ✅ Zero map licensing cost at MVP.
- ⚠️ The public OSM tile server is not for heavy production traffic: before scaling, switch the tile URL to a commercial OSM tile provider or self-hosted tiles (config-only change).
- ⚠️ The in-memory cache is per container; acceptable at low volume.
