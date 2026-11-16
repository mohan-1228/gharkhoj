"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Phase 1 location input: manual coordinates + "use area centre".
 * Replaced by the draggable map pin picker in phase 4.
 */
export function LocationPicker({
  value,
  fallbackCenter,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  fallbackCenter?: [number, number];
  onChange: (p: { lat: number; lng: number } | null) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input
        aria-label="Latitude"
        placeholder="Latitude"
        type="number"
        step="any"
        value={value?.lat ?? ""}
        onChange={(e) => onChange(e.target.value ? { lat: Number(e.target.value), lng: value?.lng ?? 0 } : null)}
      />
      <Input
        aria-label="Longitude"
        placeholder="Longitude"
        type="number"
        step="any"
        value={value?.lng ?? ""}
        onChange={(e) => onChange(e.target.value ? { lat: value?.lat ?? 0, lng: Number(e.target.value) } : null)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={!fallbackCenter}
        onClick={() => fallbackCenter && onChange({ lat: fallbackCenter[0], lng: fallbackCenter[1] })}
      >
        Use area centre
      </Button>
    </div>
  );
}
