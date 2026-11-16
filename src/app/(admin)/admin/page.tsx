import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { adminMetrics } from "@/server/services/admin-service";
import { LISTING_STATUS_LABELS, LISTING_STATUSES, TOUR_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const m = await adminMetrics(await getCurrentUser());
  const attention = [
    { label: "Listings awaiting review", value: m.listingsByStatus.pending_review ?? 0, href: "/admin/review" },
    { label: "Open reports", value: m.openReports, href: "/admin/reports" },
    { label: "Verifications pending", value: m.pendingVerifications, href: "/admin/verifications" },
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin overview</h1>
      <section aria-label="Needs attention" className="grid gap-4 sm:grid-cols-3">
        {attention.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className={`rounded-xl border p-4 hover:shadow-sm ${a.value > 0 ? "border-amber-300 bg-amber-50" : ""}`}
          >
            <p className="text-muted-foreground text-sm">{a.label}</p>
            <p className="text-3xl font-bold tabular-nums">{a.value}</p>
          </Link>
        ))}
      </section>
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Users</h2>
          <dl className="mt-2 space-y-1 text-sm">
            {["renter", "landlord", "admin"].map((r) => (
              <div key={r} className="flex justify-between capitalize">
                <dt>{r}s</dt>
                <dd className="tabular-nums">{m.usersByRole[r] ?? 0}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1">
              <dt>New (7 days)</dt>
              <dd className="tabular-nums">{m.newUsers7d}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Listings</h2>
          <dl className="mt-2 space-y-1 text-sm">
            {LISTING_STATUSES.map((s) => (
              <div key={s} className="flex justify-between">
                <dt>{LISTING_STATUS_LABELS[s]}</dt>
                <dd className="tabular-nums">{m.listingsByStatus[s] ?? 0}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1">
              <dt>New (7 days)</dt>
              <dd className="tabular-nums">{m.newListings7d}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Tours</h2>
          <dl className="mt-2 space-y-1 text-sm">
            {TOUR_STATUSES.map((s) => (
              <div key={s} className="flex justify-between capitalize">
                <dt>{s.replace("_", " ")}</dt>
                <dd className="tabular-nums">{m.toursByStatus[s] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
