"use client";

import dynamic from "next/dynamic";
import type { PinPickerProps } from "@/components/map/pin-picker-client";

/** Draggable map pin picker (Leaflet, client-only). */
const PinPicker = dynamic(() => import("@/components/map/pin-picker-client"), {
  ssr: false,
  loading: () => <div className="bg-muted h-72 w-full animate-pulse rounded-lg" />,
});

export function LocationPicker(props: PinPickerProps) {
  return <PinPicker {...props} />;
}
