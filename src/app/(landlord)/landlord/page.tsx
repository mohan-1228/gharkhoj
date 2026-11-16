import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Heart, CalendarClock, Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { landlordStats } from "@/server/services/landlord-service";
import { LISTING_STATUS_LABELS, LISTING_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Landlord dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LandlordDashboard() {
  const user = await getCurrentUser();
  const stats = await landlordStats(user);
  const totalListings = Object.values(stats.listingsByStatus).reduce((a, b) => a + b, 0);
  const tiles = [
    { label: "Listings", value: totalListings, icon: Building2, href: "/landlord/listings" },
    { label: "Total views", value: stats.totalViews.toLocaleString("en-IN"), icon: Eye },
    { label: "Saved by renters", value: stats.totalFavorites, icon: Heart },
    { label: "Tour requests waiting", value: stats.pendingTourRequests, icon: CalendarClock, href: "/landlord/tours" },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Namaste, {user?.fullName.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm">Here&apos;s how your listings are doing.</p>
        </div>
        <Button asChild>
          <Link href="/landlord/listings/new">New listing</Link>
        </Button>
      </div>

      {stats.verificationStatus !== "verified" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-5" aria-hidden />
            {stats.verificationStatus === "pending"
              ? "Your verification documents are being reviewed."
              : "Get the Verified badge — renters trust verified landlords more."}
          </p>
          {stats.verificationStatus !== "pending" && (
            <Button asChild size="sm" variant="outline">
              <Link href="/landlord/verification">Verify now</Link>
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <dl className="rounded-xl border p-4 transition hover:shadow-sm">
              <dt className="text-muted-foreground flex items-center gap-2 text-sm">
                <t.icon className="size-4" aria-hidden /> {t.label}
              </dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums">{t.value}</dd>
            </dl>
          );
          return t.href ? (
            <Link key={t.label} href={t.href}>
              {body}
            </Link>
          ) : (
            <div key={t.label}>{body}</div>
          );
        })}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Listings by status</h2>
        <ul className="flex flex-wrap gap-2">
          {LISTING_STATUSES.map((s) => (
            <li key={s} className="rounded-full border px-3 py-1 text-sm">
              {LISTING_STATUS_LABELS[s]}: <strong>{stats.listingsByStatus[s] ?? 0}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
