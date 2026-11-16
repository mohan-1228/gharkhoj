/**
 * Seeds reference data (cities, neighbourhoods, amenities) and SYNTHETIC demo
 * data (users, listings, placeholder photos). No real/scraped listings — see
 * ADR-0006. Idempotent for reference data; demo data is replaced on each run.
 *
 * Run: pnpm db:seed   (requires docker compose services + pnpm storage:setup)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import sharp from "sharp";
import { AMENITIES, CITIES } from "./data";
import { processImage } from "../../src/server/media/process-image";
import { putObject, ensureLocalBucket } from "../../src/server/lib/storage";
import { slugify } from "../../src/lib/format";

const prisma = new PrismaClient();

// Deterministic PRNG so the demo data is the same on every machine.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const sample = <T>(arr: readonly T[], n: number): T[] => [...arr].sort(() => rand() - 0.5).slice(0, n);

export const DEMO_USERS = {
  admin: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@gharkhoj.local",
    fullName: "Admin User",
    role: "admin" as const,
  },
  landlord: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "sita.landlord@gharkhoj.local",
    fullName: "Sita Shrestha",
    role: "landlord" as const,
  },
  landlord2: {
    id: "00000000-0000-4000-8000-000000000003",
    email: "ram.landlord@gharkhoj.local",
    fullName: "Ram Gurung",
    role: "landlord" as const,
  },
  renter: {
    id: "00000000-0000-4000-8000-000000000004",
    email: "anisha.renter@gharkhoj.local",
    fullName: "Anisha Karki",
    role: "renter" as const,
  },
};

const PHOTO_SETS = [
  { label: "Living room", hue: 28 },
  { label: "Bedroom", hue: 210 },
  { label: "Kitchen", hue: 140 },
  { label: "Bathroom", hue: 190 },
  { label: "Balcony view", hue: 45 },
  { label: "Exterior", hue: 0 },
  { label: "Office space", hue: 260 },
  { label: "Dining area", hue: 330 },
];

function placeholderSvg(label: string, hue: number): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067" viewBox="0 0 1600 1067">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},45%,82%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},40%,62%)"/>
  </linearGradient></defs>
  <rect width="1600" height="1067" fill="url(#g)"/>
  <g fill="none" stroke="hsl(${hue},30%,30%)" stroke-width="14" stroke-linejoin="round" opacity="0.55">
    <path d="M560 560 L800 360 L1040 560 V800 H560 Z"/><rect x="740" y="640" width="120" height="160"/>
  </g>
  <text x="800" y="920" font-family="Helvetica, Arial, sans-serif" font-size="64" text-anchor="middle" fill="hsl(${hue},30%,22%)">${label}</text>
  <text x="800" y="990" font-family="Helvetica, Arial, sans-serif" font-size="32" text-anchor="middle" fill="hsl(${hue},25%,30%)">Sample photo · GharKhoj demo data</text>
</svg>`);
}

async function seedPhotos(): Promise<{ mediaKey: string; label: string; width: number; height: number }[]> {
  await ensureLocalBucket();
  const out = [];
  for (const set of PHOTO_SETS) {
    const mediaKey = `media/seed/${slugify(set.label)}`;
    const processed = await processImage(await placeholderSvgToPng(set));
    for (const v of processed.variants) await putObject(`${mediaKey}/w${v.width}.webp`, v.buffer, "image/webp");
    out.push({ mediaKey, label: set.label, width: processed.width, height: processed.height });
  }
  return out;
}
// sharp needs a raster format for processImage's allow-list, so render the SVG first.
async function placeholderSvgToPng(set: { label: string; hue: number }): Promise<Buffer> {
  return sharp(placeholderSvg(set.label, set.hue)).png().toBuffer();
}

const TITLES: Record<string, string[]> = {
  room: [
    "Sunny single room near {n}",
    "Furnished room for students in {n}",
    "Spacious room with attached bath, {n}",
    "Quiet room in family house, {n}",
  ],
  studio_flat: [
    "1BHK flat with kitchen in {n}",
    "Cozy studio flat close to {n} chowk",
    "Modern 1BK flat, {n}",
    "Bright flat with balcony in {n}",
  ],
  apartment: [
    "2BHK apartment with parking, {n}",
    "3BHK apartment with lift in {n}",
    "Furnished 2BHK apartment, {n}",
    "Family apartment near {n} school",
  ],
  house: [
    "Whole house for rent in {n}",
    "3-storey house with garden, {n}",
    "Bungalow with car parking, {n}",
    "Independent house in quiet {n} lane",
  ],
  office_space: [
    "Office space on main road, {n}",
    "Co-working friendly office in {n}",
    "Commercial space for startup, {n}",
  ],
};
const RENT: Record<string, [number, number]> = {
  room: [5000, 15000],
  studio_flat: [12000, 30000],
  apartment: [30000, 90000],
  house: [50000, 200000],
  office_space: [25000, 150000],
};
const DESCRIPTIONS = [
  "Well-maintained property with reliable water supply and good sunlight throughout the day. The neighbourhood is peaceful and close to the main road, with grocery stores, a pharmacy and public transport within walking distance.",
  "Newly painted and ready to move in. Landlord lives on the ground floor and is responsive. Suitable for small families or working professionals who want a quiet place to live.",
  "Located in a safe and friendly community with easy access to schools, hospitals and supermarkets. The building has a rooftop with mountain views on clear days.",
];

async function main() {
  console.log("Seeding reference data…");
  for (const a of AMENITIES) {
    await prisma.amenity.upsert({ where: { code: a.code }, update: a, create: a });
  }
  for (const c of CITIES) {
    const city = await prisma.city.upsert({
      where: { slug: c.slug },
      update: { name: c.name, nameNe: c.nameNe, province: c.province, district: c.district },
      create: { name: c.name, nameNe: c.nameNe, slug: c.slug, province: c.province, district: c.district },
    });
    await prisma.$executeRaw`UPDATE cities SET centroid = ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}), 4326)::geography WHERE id = ${city.id}`;
    for (const n of c.neighborhoods) {
      const slug = slugify(n.name);
      const nb = await prisma.neighborhood.upsert({
        where: { cityId_slug: { cityId: city.id, slug } },
        update: { name: n.name, nameNe: n.nameNe },
        create: { cityId: city.id, name: n.name, nameNe: n.nameNe, slug },
      });
      await prisma.$executeRaw`UPDATE neighborhoods SET centroid = ST_SetSRID(ST_MakePoint(${n.lng}, ${n.lat}), 4326)::geography WHERE id = ${nb.id}`;
    }
  }

  if (process.env.SEED_DEMO === "false") return;

  console.log("Seeding demo users…");
  for (const u of Object.values(DEMO_USERS)) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, fullName: u.fullName },
      create: { ...u, isVerified: true },
    });
  }
  await prisma.landlordProfile.upsert({
    where: { userId: DEMO_USERS.landlord.id },
    update: {},
    create: {
      userId: DEMO_USERS.landlord.id,
      businessName: "Shrestha Properties",
      bio: "Managing family-owned flats in the valley since 2010.",
      verificationStatus: "verified",
      responseRate: 95,
    },
  });
  await prisma.landlordProfile.upsert({
    where: { userId: DEMO_USERS.landlord2.id },
    update: {},
    create: {
      userId: DEMO_USERS.landlord2.id,
      bio: "Rooms and flats in Pokhara and Chitwan.",
      verificationStatus: "unverified",
      responseRate: 80,
    },
  });

  console.log("Generating placeholder photos…");
  const photos = await seedPhotos();

  console.log("Seeding demo listings…");
  await prisma.listing.deleteMany({ where: { landlordId: { in: [DEMO_USERS.landlord.id, DEMO_USERS.landlord2.id] } } });
  const amenities = await prisma.amenity.findMany();
  const cities = await prisma.city.findMany({ include: { neighborhoods: true } });
  const weights = { kathmandu: 14, lalitpur: 8, bhaktapur: 4, pokhara: 8 } as Record<string, number>;
  const types = ["room", "studio_flat", "apartment", "house", "office_space"] as const;
  const now = Date.now();
  let count = 0;

  for (const city of cities) {
    const n = weights[city.slug] ?? 2;
    const src = CITIES.find((c) => c.slug === city.slug)!;
    for (let i = 0; i < n; i++) {
      const nb = pick(city.neighborhoods);
      const nbSrc = src.neighborhoods.find((x) => slugify(x.name) === nb.slug)!;
      const type = pick(types);
      const [lo, hi] = RENT[type]!;
      const cityFactor = ["kathmandu", "lalitpur"].includes(city.slug) ? 1 : 0.7;
      const rent = Math.round((between(lo, hi) * cityFactor) / 500) * 500;
      const beds =
        type === "room"
          ? 1
          : type === "studio_flat"
            ? 1
            : type === "apartment"
              ? between(2, 3)
              : type === "house"
                ? between(3, 6)
                : 0;
      const title = pick(TITLES[type]!).replace("{n}", nb.name);
      const landlordId = i % 3 === 2 ? DEMO_USERS.landlord2.id : DEMO_USERS.landlord.id;
      const status = count % 17 === 5 ? "pending_review" : count % 23 === 7 ? "draft" : "published";
      const publishedAt = status === "published" ? new Date(now - between(1, 40) * 86_400_000) : null;
      const chosen = sample(amenities, between(5, 12));

      const data: Prisma.ListingUncheckedCreateInput = {
        landlordId,
        title,
        slug: `${slugify(title)}-${(count + 1).toString(36).padStart(4, "0")}`,
        description: pick(DESCRIPTIONS),
        propertyType: type,
        status,
        rentNpr: rent,
        depositNpr: rent * between(1, 3),
        negotiable: rand() > 0.6,
        availableFrom: new Date(now + between(-10, 45) * 86_400_000),
        minLeaseMonths: pick([1, 3, 6, 12]),
        bedrooms: beds,
        bathrooms: Math.max(1, Math.ceil(beds / 2)),
        areaSqft: type === "room" ? between(120, 220) : type === "house" ? between(1500, 4000) : between(450, 1600),
        floorNo: type === "house" ? null : between(0, 5),
        totalFloors: between(3, 7),
        furnishing: pick(["unfurnished", "semi", "fully"] as const),
        parkingBikes: between(0, 3),
        parkingCars: type === "room" ? 0 : between(0, 2),
        waterSupply: sample(["tank", "boring", "municipal"], between(1, 2)),
        electricityBackup: pick(["none", "inverter", "generator", "solar"] as const),
        internetAvailable: rand() > 0.3,
        wasteCollection: rand() > 0.2,
        gas: pick(["lpg", "lpg", "none", "piped"] as const),
        tenantTypes:
          type === "office_space"
            ? ["professionals"]
            : sample(["family", "bachelors", "students", "couples", "professionals"], between(1, 3)),
        petsAllowed: rand() > 0.7,
        smokingAllowed: rand() > 0.85,
        cityId: city.id,
        neighborhoodId: nb.id,
        wardNo: between(1, 32),
        landmark: `Near ${nb.name} ${pick(["chowk", "temple", "school", "bus park"])}`,
        locationIsApproximate: rand() > 0.4,
        viewCount: between(0, 400),
        publishedAt,
        amenities: { create: chosen.map((a) => ({ amenityId: a.id })) },
        photos: {
          create: sample(photos, between(3, 6)).map((p, idx) => ({
            s3Key: `${p.mediaKey}/original`,
            mediaKey: p.mediaKey,
            roomLabel: p.label,
            caption: p.label,
            sortOrder: idx,
            isCover: idx === 0,
            width: p.width,
            height: p.height,
            status: "ready" as const,
          })),
        },
        availability: {
          create: [0, 6].map((d) => ({ dayOfWeek: d, startTime: "10:00", endTime: "17:00" })),
        },
      };
      const listing = await prisma.listing.create({ data });
      const lat = nbSrc.lat + (rand() - 0.5) * 0.012;
      const lng = nbSrc.lng + (rand() - 0.5) * 0.012;
      await prisma.$executeRaw`UPDATE listings SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography WHERE id = ${listing.id}::uuid`;
      count++;
    }
  }
  console.log(`Seeded ${count} demo listings across ${cities.length} cities.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
