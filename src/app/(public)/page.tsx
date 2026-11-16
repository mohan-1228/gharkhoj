import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/listings/listing-card";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { search } from "@/server/services/search-service";
import { getCities } from "@/server/services/lookup-service";

export const revalidate = 300; // ISR: rebuild the homepage at most every 5 minutes

export default async function HomePage() {
  const t = await getTranslations("home");
  const [featured, cities] = await Promise.all([search({ sort: "newest", page: 1, limit: 8 }), getCities()]);

  return (
    <>
      <section className="from-primary/10 via-background to-background relative overflow-hidden border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">{t("heroTitle")}</h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg">{t("heroSubtitle")}</p>
          <form
            action="/rent"
            method="get"
            role="search"
            className="bg-background mt-8 flex max-w-2xl flex-col gap-2 rounded-xl border p-2 shadow-sm sm:flex-row"
          >
            <label htmlFor="hero-q" className="sr-only">
              {t("searchPlaceholder")}
            </label>
            <input
              id="hero-q"
              name="q"
              placeholder={t("searchPlaceholder")}
              className="h-11 flex-1 rounded-md px-3 outline-none"
              autoComplete="off"
            />
            <label htmlFor="hero-city" className="sr-only">
              City
            </label>
            <select
              id="hero-city"
              name="city"
              className="h-11 rounded-md border bg-transparent px-3 text-sm sm:w-44"
              defaultValue=""
            >
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="lg" className="h-11">
              <Search className="size-4" /> {t("search")}
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-semibold">{t("popularCities")}</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/rent/${c.slug}`}
                className="hover:border-primary block rounded-xl border p-4 transition hover:shadow-sm"
              >
                <span className="block font-semibold">{c.name}</span>
                {c.nameNe && (
                  <span className="text-muted-foreground block text-sm" lang="ne">
                    {c.nameNe}
                  </span>
                )}
                <span className="text-muted-foreground mt-1 block text-xs">
                  {c.listingCount} rental{c.listingCount === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">{t("featured")}</h2>
            <Link href="/rent" className="text-primary text-sm font-medium hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.items.map((l, i) => (
              <li key={l.id}>
                <ListingCard listing={l} priority={i < 2} action={<FavoriteButton listingId={l.id} />} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="bg-primary text-primary-foreground flex flex-col items-start justify-between gap-4 rounded-2xl p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold">{t("forLandlords")}</h2>
            <p className="mt-1 max-w-xl opacity-90">{t("forLandlordsBody")}</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/landlord/listings/new">{t("startListing")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
