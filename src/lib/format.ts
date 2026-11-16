import { TIMEZONE } from "./constants";

/** Indian-style digit grouping (1,00,000) is the norm in Nepal. */
const nprFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** `Rs. 25,000` */
export function formatNpr(amount: number): string {
  return `Rs. ${nprFormatter.format(amount)}`;
}

/** `Rs. 25,000 / month` */
export function formatRent(amount: number): string {
  return `${formatNpr(amount)} / month`;
}

/** Compact price for map pins: 25000 → "25K", 150000 → "1.5L" (lakh). */
export function formatNprCompact(amount: number): string {
  if (amount >= 100_000) return `${trim(amount / 100_000)}L`;
  if (amount >= 1_000) return `${trim(amount / 1_000)}K`;
  return String(amount);
}
function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

// Traditional hill-region land units (Kathmandu Valley system).
const SQFT_PER_ROPANI = 5476;
const SQFT_PER_AANA = 342.25;
const SQFT_PER_PAISA = 85.5625;
const SQFT_PER_DAAM = 21.390625;

export function formatSqft(sqft: number): string {
  return `${new Intl.NumberFormat("en-IN").format(sqft)} sq ft`;
}

/** 5476 sq ft → "1-0-0-0" (ropani-aana-paisa-daam). */
export function sqftToRopani(sqft: number): string {
  let rest = sqft;
  const ropani = Math.floor(rest / SQFT_PER_ROPANI);
  rest -= ropani * SQFT_PER_ROPANI;
  const aana = Math.floor(rest / SQFT_PER_AANA);
  rest -= aana * SQFT_PER_AANA;
  const paisa = Math.floor(rest / SQFT_PER_PAISA);
  rest -= paisa * SQFT_PER_PAISA;
  const daam = Math.round(rest / SQFT_PER_DAAM);
  return `${ropani}-${aana}-${paisa}-${daam}`;
}

/** Format a UTC instant in Nepal time, e.g. "Sat, 16 Nov 2026, 2:30 PM". */
export function formatKathmandu(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...opts,
  }).format(d);
}

export function formatDateOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
    d,
  );
}

/**
 * Normalise a Nepali mobile number to E.164 (+9779XXXXXXXXX).
 * Accepts "98XXXXXXXX", "9779XXXXXXXXX", "+977-98XXXXXXXX", with spaces/dashes.
 * Returns null if the number is not a valid Nepal mobile (prefix 96/97/98).
 */
export function normalizeNepaliMobile(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("977") ? digits.slice(3) : digits;
  return /^9[678]\d{8}$/.test(local) ? `+977${local}` : null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
