import type { TourStatusValue } from "@/lib/constants";
import { addDaysKtm, ktmToUtc, utcToKtm } from "@/lib/time";
import { AppError, forbidden } from "../lib/errors";

/**
 * Tour domain rules (CLAUDE.md §4.4). Pure — no I/O.
 *   requested → confirmed | declined | rescheduled
 *   rescheduled (landlord proposed a new time) → confirmed (renter accepts) | cancelled
 *   confirmed → completed | no_show | cancelled | rescheduled
 */
export type TourAction = "confirm" | "decline" | "reschedule" | "cancel" | "complete" | "no_show";
export type Party = "landlord" | "renter";

const RULES: Record<TourAction, { by: Party[]; from: TourStatusValue[]; to: TourStatusValue }> = {
  confirm: { by: ["landlord", "renter"], from: ["requested", "rescheduled"], to: "confirmed" },
  decline: { by: ["landlord"], from: ["requested", "rescheduled"], to: "declined" },
  reschedule: { by: ["landlord"], from: ["requested", "confirmed"], to: "rescheduled" },
  cancel: { by: ["renter", "landlord"], from: ["requested", "confirmed", "rescheduled"], to: "cancelled" },
  complete: { by: ["landlord"], from: ["confirmed"], to: "completed" },
  no_show: { by: ["landlord"], from: ["confirmed"], to: "no_show" },
};

export function tourTransition(status: TourStatusValue, action: TourAction, party: Party): TourStatusValue {
  const rule = RULES[action];
  if (!rule.by.includes(party))
    throw forbidden(`Only the ${rule.by.join(" or ")} can ${action.replace("_", " ")} a tour`);
  // A renter may only "confirm" to accept a landlord's proposed new time.
  if (action === "confirm" && party === "renter" && status !== "rescheduled")
    throw forbidden("Waiting for the landlord to confirm");
  if (action === "confirm" && party === "landlord" && status === "rescheduled")
    throw forbidden("Waiting for the renter to accept the new time");
  if (!rule.from.includes(status)) {
    throw new AppError(
      "INVALID_STATE",
      `Cannot ${action.replace("_", " ")} a tour that is ${status.replace("_", " ")}`,
    );
  }
  return rule.to;
}

export interface Window {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export const SLOT_MINUTES = 30;
export const MIN_LEAD_MINUTES = 120; // at least 2h notice
export const MAX_DAYS_AHEAD = 30;
/** When a landlord hasn't set availability, offer reasonable daytime hours every day. */
export const DEFAULT_WINDOWS: Window[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d,
  startTime: "09:00",
  endTime: "18:00",
}));

function minutes(t: string) {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
}
function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Bookable slots (UTC ISO) grouped by Kathmandu date for the next `days` days. */
export function generateSlots(opts: {
  windows: Window[];
  exceptions: string[]; // "YYYY-MM-DD" unavailable dates
  taken: Date[]; // already-confirmed slots
  now: Date;
  days?: number;
}): { date: string; slots: string[] }[] {
  const windows = opts.windows.length ? opts.windows : DEFAULT_WINDOWS;
  const blocked = new Set(opts.exceptions);
  const taken = new Set(opts.taken.map((d) => d.toISOString()));
  const earliest = opts.now.getTime() + MIN_LEAD_MINUTES * 60_000;
  const today = utcToKtm(opts.now).date;
  const out: { date: string; slots: string[] }[] = [];

  for (let i = 0; i < (opts.days ?? 14); i++) {
    const date = addDaysKtm(today, i);
    if (blocked.has(date)) continue;
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const slots: string[] = [];
    for (const w of windows.filter((x) => x.dayOfWeek === dow)) {
      for (let m = minutes(w.startTime); m + SLOT_MINUTES <= minutes(w.endTime); m += SLOT_MINUTES) {
        const utc = ktmToUtc(date, hhmm(m));
        if (utc.getTime() < earliest || taken.has(utc.toISOString())) continue;
        slots.push(utc.toISOString());
      }
    }
    if (slots.length) out.push({ date, slots: [...new Set(slots)].sort() });
  }
  return out;
}

/** Validate renter-chosen slots against availability rules. */
export function assertSlotsBookable(slots: Date[], opts: { windows: Window[]; exceptions: string[]; now: Date }): void {
  const windows = opts.windows.length ? opts.windows : DEFAULT_WINDOWS;
  const blocked = new Set(opts.exceptions);
  const earliest = opts.now.getTime() + MIN_LEAD_MINUTES * 60_000;
  const latest = opts.now.getTime() + MAX_DAYS_AHEAD * 86_400_000;
  for (const s of slots) {
    const t = s.getTime();
    if (t < earliest) throw new AppError("VALIDATION_ERROR", "Tour times must be at least 2 hours from now");
    if (t > latest) throw new AppError("VALIDATION_ERROR", `Tour times must be within ${MAX_DAYS_AHEAD} days`);
    const k = utcToKtm(s);
    if (blocked.has(k.date)) throw new AppError("VALIDATION_ERROR", `The landlord is unavailable on ${k.date}`);
    const m = minutes(k.time);
    const fits = windows.some(
      (w) => w.dayOfWeek === k.dayOfWeek && m >= minutes(w.startTime) && m + SLOT_MINUTES <= minutes(w.endTime),
    );
    if (!fits) throw new AppError("VALIDATION_ERROR", `${k.date} ${k.time} is outside the landlord's available hours`);
  }
  if (new Set(slots.map((s) => s.getTime())).size !== slots.length)
    throw new AppError("VALIDATION_ERROR", "Pick different times");
}

/** RFC 5545 calendar event for a confirmed tour (add-to-calendar). */
export function buildIcs(e: {
  uid: string;
  start: Date;
  minutes: number;
  title: string;
  description: string;
  location: string;
  url: string;
}): string {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const end = new Date(e.start.getTime() + e.minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GharKhoj//Tours//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@gharkhoj`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `LOCATION:${esc(e.location)}`,
    `URL:${e.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tour reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
