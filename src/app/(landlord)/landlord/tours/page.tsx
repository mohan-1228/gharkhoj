import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/session";
import { listLandlordTours } from "@/server/services/tour-service";
import { TourCard } from "@/components/tours/tour-card";

export const metadata: Metadata = { title: "Tour requests", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LandlordToursPage() {
  const tours = await listLandlordTours(await getCurrentUser());
  const open = tours.filter((t) => ["requested", "rescheduled", "confirmed"].includes(t.status));
  const past = tours.filter((t) => !open.includes(t));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Tour requests</h1>
      <p className="text-muted-foreground text-sm">Respond quickly — your response rate is shown to renters.</p>
      <h2 className="mt-6 mb-3 text-lg font-semibold">Open ({open.length})</h2>
      {open.length === 0 ? (
        <p className="text-muted-foreground text-sm">No open requests.</p>
      ) : (
        <ul className="space-y-3">
          {open.map((t) => (
            <li key={t.id}>
              <TourCard tour={t} viewer="landlord" />
            </li>
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold">History</h2>
          <ul className="space-y-3">
            {past.map((t) => (
              <li key={t.id}>
                <TourCard tour={t} viewer="landlord" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
