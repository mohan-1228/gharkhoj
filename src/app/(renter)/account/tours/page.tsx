import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { listMyTours } from "@/server/services/tour-service";
import { TourCard } from "@/components/tours/tour-card";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: "My tours", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyToursPage() {
  const tours = await listMyTours(await getCurrentUser());
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">My tours</h1>
      <AccountNav current="/account/tours" />
      {tours.length === 0 ? (
        <p className="text-muted-foreground mt-8">
          You haven&apos;t requested any tours yet.{" "}
          <Link href="/rent" className="text-primary underline">
            Find a place to visit
          </Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {tours.map((t) => (
            <li key={t.id}>
              <TourCard tour={t} viewer="renter" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
