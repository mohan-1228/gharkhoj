import type { SearchQuery } from "@/schemas/search";

/** Placeholder until the Leaflet map view lands (phase 4). */
export function SearchMapSlot({ query: _query }: { query: SearchQuery }) {
  return (
    <div className="text-muted-foreground flex h-[60vh] items-center justify-center rounded-xl border border-dashed text-sm">
      Map view coming soon
    </div>
  );
}
