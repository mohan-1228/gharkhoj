import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./logo";

const CITIES = [
  ["kathmandu", "Kathmandu"],
  ["lalitpur", "Lalitpur"],
  ["bhaktapur", "Bhaktapur"],
  ["pokhara", "Pokhara"],
  ["biratnagar", "Biratnagar"],
  ["bharatpur", "Bharatpur"],
] as const;

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="bg-muted/40 mt-16 border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-2">
          <Logo />
          <p className="text-muted-foreground text-sm">{t("tagline")}</p>
        </div>
        <nav aria-label="Popular cities">
          <h2 className="mb-2 text-sm font-semibold">Rent by city</h2>
          <ul className="text-muted-foreground grid grid-cols-2 gap-1 text-sm">
            {CITIES.map(([slug, name]) => (
              <li key={slug}>
                <Link href={`/rent/${slug}`} className="hover:text-foreground hover:underline">
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="mb-2 text-sm font-semibold">GharKhoj</h2>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>
              <Link href="/help" className="hover:text-foreground hover:underline">
                {t("help")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground hover:underline">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground hover:underline">
                {t("terms")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="text-muted-foreground border-t py-4 text-center text-xs">
        © {new Date().getFullYear()} GharKhoj. Listings are provided by landlords; verify details before paying any
        deposit.
      </p>
    </footer>
  );
}
