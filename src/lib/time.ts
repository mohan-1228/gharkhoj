/**
 * Nepal time helpers. Asia/Kathmandu is a fixed UTC+05:45 with no DST, so
 * conversions are exact arithmetic (no tz database needed, works in the browser).
 * Storage is always UTC (CLAUDE.md §9).
 */
export const KTM_OFFSET_MIN = 5 * 60 + 45;

/** "2026-11-20" + "14:30" in Kathmandu → UTC Date */
export function ktmToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - KTM_OFFSET_MIN * 60_000);
}

/** UTC Date → Kathmandu wall-clock parts */
export function utcToKtm(d: Date): { date: string; time: string; dayOfWeek: number } {
  const local = new Date(d.getTime() + KTM_OFFSET_MIN * 60_000);
  const date = local.toISOString().slice(0, 10);
  const time = local.toISOString().slice(11, 16);
  return { date, time, dayOfWeek: local.getUTCDay() };
}

export function addDaysKtm(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
