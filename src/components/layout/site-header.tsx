import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { HeaderAuth } from "@/components/auth/header-auth";
import { Logo } from "./logo";

/** Static header shell; the signed-in part hydrates client-side so pages stay CDN/ISR-cacheable. */
export async function SiteHeader() {
  const t = await getTranslations("nav");
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/rent">{t("rent")}</Link>
          </Button>
          <HeaderAuth
            labels={{
              favorites: t("favorites"),
              dashboard: t("dashboard"),
              listProperty: t("listProperty"),
              signIn: t("signIn"),
            }}
          />
        </nav>
      </div>
    </header>
  );
}
