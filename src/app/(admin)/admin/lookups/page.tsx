import { getCurrentUser } from "@/server/auth/session";
import { assertRole } from "@/server/auth/guards";
import { prisma } from "@/server/lib/db";
import { LookupForms } from "@/components/admin/lookup-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lookup data" };

export default async function LookupsPage() {
  assertRole(await getCurrentUser(), "admin");
  const [cities, amenities] = await Promise.all([
    prisma.city.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { neighborhoods: true, listings: true } } },
    }),
    prisma.amenity.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] }),
  ]);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Lookup data</h1>
      <LookupForms
        cities={cities.map((c) => ({
          id: c.id,
          name: c.name,
          province: c.province,
          isActive: c.isActive,
          neighborhoods: c._count.neighborhoods,
          listings: c._count.listings,
        }))}
        amenities={amenities.map((a) => ({ code: a.code, label: a.label, category: a.category }))}
      />
    </div>
  );
}
