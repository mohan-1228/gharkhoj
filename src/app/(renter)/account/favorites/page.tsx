import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { listFavorites } from "@/server/services/favorite-service";
import { ListingCard } from "@/components/listings/listing-card";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: "Favourites", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const items = await listFavorites(await getCurrentUser());
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Favourites</h1>
      <AccountNav current="/account/favorites" />
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-8">
          No favourites yet. Tap the heart on any listing to save it.{" "}
          <Link href="/rent" className="text-primary underline">
            Browse rentals
          </Link>
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => (
            <li key={l.id}>
              <ListingCard listing={l} action={<FavoriteButton listingId={l.id} />} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
