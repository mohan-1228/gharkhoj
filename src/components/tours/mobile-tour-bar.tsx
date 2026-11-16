"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatNpr } from "@/lib/format";
import { TourRequestPanel } from "./tour-request-panel";

/** Mobile: fixed bottom bar with price + CTA that opens the tour panel in a sheet. */
export function MobileTourBar({ listingId, rentNpr }: { listingId: string; rentNpr: number }) {
  return (
    <div
      className="bg-background/95 fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <p className="font-bold">
        {formatNpr(rentNpr)} <span className="text-muted-foreground text-xs font-normal">/ month</span>
      </p>
      <Sheet>
        <SheetTrigger asChild>
          <Button size="lg">Schedule a tour</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Schedule a tour</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <TourRequestPanel listingId={listingId} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
