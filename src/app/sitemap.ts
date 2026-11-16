import type { MetadataRoute } from "next";
import { prisma } from "@/server/lib/db";
import { PROPERTY_TYPE_SLUGS } from "@/lib/constants";

export const dynamic = "force-dynamic"; // generated on request (needs DB)

/** sitemap.xml: home, city pages, neighbourhood + type pages, every published listing. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [cities, listings] = await Promise.all([
    prisma.city.findMany({ where: { isActive: true }, include: { neighborhoods: { select: { slug: true } } } }),
    prisma.listing.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
      take: 45_000,
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/rent`, changeFrequency: "hourly", priority: 0.9 },
    ...cities.flatMap((c) => [
      { url: `${base}/rent/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 },
      ...Object.keys(PROPERTY_TYPE_SLUGS).map((t) => ({
        url: `${base}/rent/${c.slug}/${t}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
      ...c.neighborhoods.map((n) => ({
        url: `${base}/rent/${c.slug}/${n.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    ]),
    ...listings.map((l) => ({
      url: `${base}/listing/${l.slug}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
