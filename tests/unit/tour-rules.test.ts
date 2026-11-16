import { describe, expect, it } from "vitest";
import { assertSlotsBookable, buildIcs, generateSlots, tourTransition } from "@/server/services/tour-rules";
import { ktmToUtc, utcToKtm } from "@/lib/time";

describe("Kathmandu time", () => {
  it("converts with the +05:45 offset", () => {
    expect(ktmToUtc("2026-11-20", "14:30").toISOString()).toBe("2026-11-20T08:45:00.000Z");
    expect(utcToKtm(new Date("2026-11-20T20:00:00Z"))).toEqual({ date: "2026-11-21", time: "01:45", dayOfWeek: 6 });
  });
});

describe("tourTransition", () => {
  it("landlord confirms a requested tour", () =>
    expect(tourTransition("requested", "confirm", "landlord")).toBe("confirmed"));
  it("renter accepts a landlord's new time", () =>
    expect(tourTransition("rescheduled", "confirm", "renter")).toBe("confirmed"));
  it("renter cannot confirm their own request", () =>
    expect(() => tourTransition("requested", "confirm", "renter")).toThrow(/Waiting for the landlord/));
  it("only landlords decline / complete", () => {
    expect(() => tourTransition("requested", "decline", "renter")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(() => tourTransition("confirmed", "complete", "renter")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
  it("cannot act on finished tours", () => {
    expect(() => tourTransition("completed", "cancel", "renter")).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
    expect(() => tourTransition("declined", "confirm", "landlord")).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
  });
});

describe("slots", () => {
  const now = new Date("2026-11-16T03:15:00Z"); // Mon 09:00 in Kathmandu
  const windows = [
    { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
    { dayOfWeek: 6, startTime: "10:00", endTime: "11:00" },
  ];

  it("generates 30-minute slots inside windows, respecting 2h lead time, exceptions and taken slots", () => {
    const days = generateSlots({
      windows,
      exceptions: ["2026-11-21"],
      taken: [ktmToUtc("2026-11-23", "10:30")],
      now,
      days: 8,
    });
    expect(days.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-23"]);
    // Today: 09:00 + 2h lead → first slot 11:00, last starts 11:30
    expect(days[0]!.slots.map((s) => utcToKtm(new Date(s)).time)).toEqual(["11:00", "11:30"]);
    expect(days[1]!.slots.map((s) => utcToKtm(new Date(s)).time)).toEqual(["10:00", "11:00", "11:30"]);
  });

  it("validates chosen slots", () => {
    expect(() =>
      assertSlotsBookable([ktmToUtc("2026-11-23", "10:00")], { windows, exceptions: [], now }),
    ).not.toThrow();
    expect(() => assertSlotsBookable([ktmToUtc("2026-11-16", "10:00")], { windows, exceptions: [], now })).toThrow(
      /2 hours/,
    );
    expect(() => assertSlotsBookable([ktmToUtc("2026-11-17", "10:00")], { windows, exceptions: [], now })).toThrow(
      /outside/,
    );
    expect(() =>
      assertSlotsBookable([ktmToUtc("2026-11-23", "10:00")], { windows, exceptions: ["2026-11-23"], now }),
    ).toThrow(/unavailable/);
    expect(() => assertSlotsBookable([ktmToUtc("2027-02-01", "10:00")], { windows: [], exceptions: [], now })).toThrow(
      /within 30 days/,
    );
  });

  it("falls back to default daytime hours when the landlord has no availability", () => {
    expect(() =>
      assertSlotsBookable([ktmToUtc("2026-11-18", "15:00")], { windows: [], exceptions: [], now }),
    ).not.toThrow();
    expect(() => assertSlotsBookable([ktmToUtc("2026-11-18", "21:00")], { windows: [], exceptions: [], now })).toThrow(
      /outside/,
    );
  });
});

describe("buildIcs", () => {
  it("produces a valid VEVENT with escaped text", () => {
    const ics = buildIcs({
      uid: "t1",
      start: new Date("2026-11-20T08:45:00Z"),
      minutes: 30,
      title: "Tour: Flat, Baneshwor",
      description: "Line1\nLine2",
      location: "Baneshwor; Kathmandu",
      url: "http://x/listing/a",
    });
    expect(ics).toContain("DTSTART:20261120T084500Z");
    expect(ics).toContain("DTEND:20261120T091500Z");
    expect(ics).toContain("SUMMARY:Tour: Flat\\, Baneshwor");
    expect(ics).toContain("LOCATION:Baneshwor\; Kathmandu");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
