import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieNotice } from "@/components/layout/cookie-notice";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "GharKhoj — Rooms, flats & houses for rent in Nepal", template: "%s | GharKhoj" },
  description:
    "Find rooms, flats, apartments, houses and office space for rent in Kathmandu, Lalitpur, Pokhara and across Nepal. Search by map, filter by price and amenities, and schedule tours.",
  applicationName: "GharKhoj",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
  openGraph: { type: "website", siteName: "GharKhoj", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b91c1c",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-dvh flex-col antialiased`}>
        <a
          href="#main"
          className="focus:bg-background sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <NextIntlClientProvider>
          <Providers>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <CookieNotice />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
