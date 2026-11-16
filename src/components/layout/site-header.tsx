import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Button asChild variant="ghost" size="sm">
            <Link href="/rent">{t("rent")}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
